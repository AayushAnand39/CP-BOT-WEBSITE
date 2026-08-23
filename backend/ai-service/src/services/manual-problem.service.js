const crypto = require("crypto");
const { env } = require("../config/env");
const llm = require("./llm.service");
const platform = require("./platform-clients.service");
const AppError = require("../utils/app-error");

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeTags(tags) {
  if (Array.isArray(tags))
    return tags
      .map(String)
      .map((x) => x.trim())
      .filter(Boolean);
  return String(tags || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeExamples(examples) {
  return Array.isArray(examples)
    ? examples
        .filter(
          (x) =>
            x && typeof x.input === "string" && typeof x.output === "string",
        )
        .map((x) => ({
          input: x.input,
          output: x.output,
          ...(x.explanation ? { explanation: x.explanation } : {}),
        }))
    : [];
}

function publicProblem(problem) {
  if (!problem || typeof problem !== "object") return problem;
  const {
    solutionCode,
    generatorCode,
    generatorHash,
    testcaseArtifactJson,
    ...safe
  } = problem;
  return safe;
}

async function polishProblem(input) {
  return llm.polishManualProblem(input);
}

async function generateGenerator(input) {
  const ai = await llm.generateManualGenerator(input);
  return { generatorCode: ai.generatorCode, concepts: ai.concepts || [] };
}

async function generateApprovedTestcases({
  generatorCode,
  solutionCode,
  testCount,
}) {
  const testcaseJob = await platform.generateTestcases(
    generatorCode,
    solutionCode,
    testCount || env.DEFAULT_TEST_COUNT,
  );
  return { testcaseJob, generatorHash: hash(generatorCode) };
}

async function submitManualProblem(input) {
  const examples = normalizeExamples(input.examples);
  if (examples.length) {
    await platform.judgeSamples(input.solutionCode, examples);
  }

  const jobId = input.testcaseJob?.jobId;
  if (!jobId) {
    throw new AppError(
      400,
      "Generated testcase job is required before problem submission",
      "TESTCASE_JOB_REQUIRED",
    );
  }

  const testcaseMetadata = await platform.getTestcaseMetadata(jobId);
  if (!testcaseMetadata?.testCount) {
    throw new AppError(
      409,
      "Generated testcase job contains no tests",
      "TESTCASES_NOT_FOUND",
    );
  }

  const prepared = {
    source: "manual",
    sourceContestId: null,
    sourceIndex: null,
    title: input.title,
    rating: input.rating ?? null,
    tags: normalizeTags(input.tags),
    concepts: Array.isArray(input.concepts) ? input.concepts : [],
    statement: input.statement,
    inputFormat: input.inputFormat,
    outputFormat: input.outputFormat,
    constraints: input.constraints,
    examplesJson: examples,
    notes: input.notes || null,
    editorial: null,
    timeLimitMs: input.timeLimitMs || 2000,
    memoryLimitMb: input.memoryLimitMb || 256,
    solutionCode: input.solutionCode,
    solutionSource: "CURATED",
    solutionSourceRef: "admin-manual",
    generatorCode: input.generatorCode,
    generatorVersion: 1,
    generatorHash: hash(input.generatorCode),
    testcaseArtifactJson: {
      jobId,
      testCount: testcaseMetadata.testCount,
      generated:
        testcaseMetadata.generated || input.testcaseJob.generated || [],
      totalBytes:
        testcaseMetadata.totalBytes ?? input.testcaseJob.totalBytes ?? null,
      archiveBytes:
        testcaseMetadata.archiveBytes ?? input.testcaseJob.archiveBytes ?? null,
    },
    deterministic: true,
    status: "READY",
  };

  const problem = await platform.persistProblem(prepared);
  return { problem: publicProblem(problem) };
}

function maintenanceProblem(problem) {
  return {
    id: problem.id,
    title: problem.title,
    statement: problem.statement,
    constraints: problem.constraints || "",
    inputFormat: problem.inputFormat || "",
    outputFormat: problem.outputFormat || "",
    examples: normalizeExamples(problem.examplesJson),
    rating: problem.rating ?? null,
    tags: problem.tags || [],
    concepts: problem.concepts || [],
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    status: problem.status,
    deterministic: problem.deterministic,
    testcaseArtifact: problem.testcaseArtifactJson || null,
    hasSolutionCode: !!problem.solutionCode,
    hasGeneratorCode: !!problem.generatorCode,
    generatorVersion: problem.generatorVersion || null,
    updatedAt: problem.updatedAt,
  };
}

async function getProblemForMaintenance(problemId) {
  const problem = await platform.getInternalProblem(problemId);
  const artifact = problem.testcaseArtifactJson || null;
  let artifactHealth = {
    jobId: artifact?.jobId || null,
    jobAvailable: false,
    archiveAvailable: false,
    testCount: artifact?.testCount || 0,
    archiveBytes: artifact?.archiveBytes ?? null,
    message: artifact?.jobId
      ? "Artifact has not been checked"
      : "No testcase artifact is attached",
  };

  if (artifact?.jobId) {
    try {
      const metadata = await platform.getTestcaseMetadata(artifact.jobId);
      artifactHealth = {
        jobId: artifact.jobId,
        jobAvailable: true,
        archiveAvailable:
          metadata.archiveBytes !== null && metadata.archiveBytes !== undefined,
        testCount: metadata.testCount || 0,
        archiveBytes: metadata.archiveBytes ?? null,
        message:
          metadata.archiveBytes == null
            ? "Testcase files exist, but testcases.zip is missing"
            : "Testcase job and archive are available",
      };
    } catch (error) {
      if (error.statusCode === 404) {
        artifactHealth = {
          ...artifactHealth,
          message: error.message || "Stored testcase job is missing",
        };
      } else {
        throw error;
      }
    }
  }

  return { problem: maintenanceProblem(problem), artifactHealth };
}

async function updateProblemContent(problemId, input) {
  const current = await platform.getInternalProblem(problemId);
  const patch = {
    title: input.title,
    statement: input.statement,
    constraints: input.constraints,
    inputFormat: input.inputFormat,
    outputFormat: input.outputFormat,
    examplesJson: normalizeExamples(input.examples),
  };

  // Keep all judging/generator artifacts untouched. This endpoint is only for
  // presentation/content maintenance.
  const updated = await platform.updateProblem(current.id, patch);
  return { problem: maintenanceProblem(updated) };
}

async function rebuildProblemArchive(problemId) {
  const problem = await platform.getInternalProblem(problemId);
  const jobId = problem.testcaseArtifactJson?.jobId;
  if (!jobId) {
    throw new AppError(
      409,
      "Problem has no testcase job to rebuild",
      "TESTCASE_JOB_REQUIRED",
    );
  }

  const metadata = await platform.rebuildTestcaseArchive(jobId);
  const testcaseArtifactJson = {
    ...(problem.testcaseArtifactJson || {}),
    jobId,
    testCount:
      metadata.testCount || problem.testcaseArtifactJson?.testCount || 0,
    generated:
      metadata.generated || problem.testcaseArtifactJson?.generated || [],
    totalBytes:
      metadata.totalBytes ?? problem.testcaseArtifactJson?.totalBytes ?? null,
    archiveBytes: metadata.archiveBytes ?? null,
    archiveRebuiltAt: new Date().toISOString(),
  };

  const updated = await platform.updateProblem(problemId, {
    testcaseArtifactJson,
    status: "READY",
    deterministic: true,
  });
  return {
    problem: maintenanceProblem(updated),
    testcaseJob: testcaseArtifactJson,
  };
}

async function regenerateProblemTestcases(problemId, testCount) {
  const problem = await platform.getInternalProblem(problemId);

  await platform.updateProblem(problemId, {
    status: "DRAFT",
  });

  if (!problem.solutionCode) {
    throw new AppError(
      409,
      "Problem has no trusted solution code",
      "SOLUTION_CODE_MISSING",
    );
  }
  if (!problem.generatorCode) {
    throw new AppError(
      409,
      "Problem has no stored generator code",
      "GENERATOR_CODE_MISSING",
    );
  }

  const testcaseJob = await platform.generateTestcases(
    problem.generatorCode,
    problem.solutionCode,
    testCount || env.DEFAULT_TEST_COUNT,
  );

  const jobId = testcaseJob?.jobId;
  if (!jobId) {
    throw new AppError(
      502,
      "Testcase Service did not return a job id",
      "TESTCASE_JOB_ID_MISSING",
    );
  }

  const metadata = await platform.getTestcaseMetadata(jobId);
  if (!metadata?.testCount) {
    throw new AppError(
      502,
      "Regenerated testcase job contains no tests",
      "TESTCASES_NOT_FOUND",
    );
  }

  const previousArtifact = problem.testcaseArtifactJson || null;
  const testcaseArtifactJson = {
    jobId,
    testCount: metadata.testCount,
    generated: metadata.generated || [],
    totalBytes: metadata.totalBytes ?? null,
    archiveBytes: metadata.archiveBytes ?? null,
    regeneratedAt: new Date().toISOString(),
    previousJobId: previousArtifact?.jobId || null,
  };

  const updated = await platform.updateProblem(problemId, {
    testcaseArtifactJson,
    status: "READY",
    deterministic: true,
  });

  return {
    problem: maintenanceProblem(updated),
    testcaseJob: testcaseArtifactJson,
    previousJobId: previousArtifact?.jobId || null,
  };
}

module.exports = {
  polishProblem,
  generateGenerator,
  generateApprovedTestcases,
  submitManualProblem,
  getProblemForMaintenance,
  updateProblemContent,
  regenerateProblemTestcases,
  rebuildProblemArchive,
};
