const crypto = require("crypto");
const { env } = require("../config/env");
const { parseProblemCode } = require("../utils/problem-code");
const codeforces = require("./codeforces.service");
const llm = require("./llm.service");
const platform = require("./platform-clients.service");
const AppError = require("../utils/app-error");

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function importProblem({
  problemCode,
  testCount = env.DEFAULT_TEST_COUNT
}) {
  const parsed = parseProblemCode(problemCode);
  const stages = [];

  function stage(name, status, details = undefined) {
    stages.push({
      name,
      status,
      at: new Date().toISOString(),
      ...(details !== undefined ? { details } : {})
    });
  }

  try {
    stage("parse", "DONE", parsed);

    const metadata = await codeforces.getProblemMetadata(
      parsed.contestId,
      parsed.problemIndex
    );
    stage("metadata", "DONE", {
      title: metadata.name,
      rating: metadata.rating,
      tags: metadata.tags
    });

    if (metadata.type !== "PROGRAMMING") {
      throw new AppError(
        422,
        "Only Codeforces PROGRAMMING problems can be imported",
        "UNSUPPORTED_PROBLEM_TYPE"
      );
    }

    const page = await codeforces.scrapeProblemPage(
      parsed.contestId,
      parsed.problemIndex
    );
    stage("statement", "DONE", {
      examples: page.examples.length,
      timeLimitMs: page.timeLimitMs,
      memoryLimitMb: page.memoryLimitMb
    });

    const trusted = await codeforces.getTrustedSolution(
      parsed.contestId,
      parsed.problemIndex
    );
    stage("solution", "DONE", {
      submissionId: trusted.submissionId,
      handle: trusted.handle,
      authorRating: trusted.authorRating,
      sourceUrl: trusted.url
    });

    await platform.judgeSamples(
      trusted.sourceCode,
      page.examples
    );
    stage("solution-validation", "DONE");

    const ai = await llm.extractConstraintsAndGenerate({
      metadata,
      page,
      solutionCode: trusted.sourceCode,
      problemCode: parsed.problemCode
    });
    stage("generator", "DONE", {
      concepts: ai.concepts
    });

    const testcaseJob = await platform.generateTestcases(
      ai.generatorCode,
      trusted.sourceCode,
      testCount
    );
    stage("testcases", "DONE", {
      jobId: testcaseJob.jobId || testcaseJob.id || null,
      testCount
    });

    const prepared = {
      source: "CODEFORCES",
      sourceContestId: String(parsed.contestId),
      sourceIndex: parsed.problemIndex,
      title: metadata.name,
      rating: metadata.rating ?? 0,
      tags: metadata.tags || [],
      concepts: ai.concepts,

      statement: page.statement,
      inputFormat: page.inputFormat,
      outputFormat: page.outputFormat,
      constraints: ai.constraints,
      examplesJson: page.examples,
      notes: page.notes || null,

      editorial: null,
      timeLimitMs: page.timeLimitMs,
      memoryLimitMb: page.memoryLimitMb,

      solutionCode: trusted.sourceCode,
      solutionSource: "codeforces_accepted_submission",
      solutionSourceRef: trusted.url,

      generatorCode: ai.generatorCode,
      generatorVersion: 1,
      generatorHash: hash(ai.generatorCode),

      deterministic: true,
      status: "READY"
    };

    const problem = await platform.persistProblem(prepared);
    stage("persist", "DONE", {
      problemId: problem?.id || null,
      status: problem?.status || "READY"
    });

    return {
      success: true,
      problemCode: parsed.problemCode,
      problem,
      testcaseJob,
      stages
    };
  } catch (error) {
    stage("failed", "FAILED", {
      code: error.code || "IMPORT_FAILED",
      message: error.message
    });

    error.details = {
      ...(error.details || {}),
      problemCode: parsed.problemCode,
      stages
    };

    throw error;
  }
}

module.exports = { importProblem };
