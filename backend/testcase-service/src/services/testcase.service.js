const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { env } = require("../config/env");
const AppError = require("../utils/app-error");
const { ensureDir, removeDir, resolveSafe } = require("./file.service");
const { compileCpp, runExecutable } = require("./command.service");
const { createZip, getArchivePath } = require("./archive.service");
const r2 = require("./r2-storage.service");

function makeJobId() {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

async function fileSize(filePath) {
  const stat = await fs.stat(filePath);
  return stat.size;
}

function getJobPaths(jobId) {
  const root = path.resolve(env.GENERATION_WORK_DIR);
  const workDir = resolveSafe(root, jobId);
  return { root, workDir, archivePath: getArchivePath(workDir) };
}

async function readLocalMetadata(jobId) {
  const { workDir, archivePath } = getJobPaths(jobId);
  let entries;
  try {
    entries = await fs.readdir(workDir);
  } catch {
    return null;
  }

  const inputFiles = entries
    .filter((name) => /^input_\d+\.txt$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  if (inputFiles.length === 0) return null;

  const generated = [];
  for (const inputFile of inputFiles) {
    const testNumber = Number(inputFile.match(/\d+/)[0]);
    const outputFile = `output_${testNumber}.txt`;
    const inputPath = resolveSafe(workDir, inputFile);
    const outputPath = resolveSafe(workDir, outputFile);
    try {
      const [inputBytes, outputBytes] = await Promise.all([
        fileSize(inputPath),
        fileSize(outputPath),
      ]);
      generated.push({
        testNumber,
        inputFile,
        outputFile,
        inputBytes,
        outputBytes,
      });
    } catch {
      throw new AppError(
        404,
        `Missing testcase pair ${testNumber}`,
        "TESTCASE_PAIR_NOT_FOUND",
      );
    }
  }

  const totalBytes = generated.reduce(
    (sum, item) => sum + item.inputBytes + item.outputBytes,
    0,
  );

  let archiveBytes = null;
  try {
    archiveBytes = await fileSize(archivePath);
  } catch {}

  return {
    jobId,
    testCount: generated.length,
    generated,
    totalBytes,
    archiveBytes,
    archiveKey: r2.isConfigured() ? r2.archiveKey(jobId) : null,
    storage: r2.isConfigured() ? "r2+local-cache" : "local",
  };
}

async function ensureLocalJob(jobId) {
  const { workDir } = getJobPaths(jobId);
  const local = await readLocalMetadata(jobId);
  if (local) return { workDir, metadata: local, restored: false };

  const manifest = await r2.readManifest(jobId);
  if (!manifest) {
    throw new AppError(
      404,
      "Testcase job not found locally or in R2",
      "TESTCASE_JOB_NOT_FOUND",
    );
  }

  const restored = await r2.restoreJobFiles(jobId, workDir, manifest);
  if (!restored) {
    throw new AppError(
      404,
      "Testcase job could not be restored from R2",
      "TESTCASE_JOB_NOT_FOUND",
    );
  }

  const metadata = await readLocalMetadata(jobId);
  if (!metadata) {
    throw new AppError(
      404,
      "Restored testcase job contains no testcase files",
      "TESTCASES_NOT_FOUND",
    );
  }

  return {
    workDir,
    metadata: {
      ...metadata,
      archiveKey: manifest.archiveKey || r2.archiveKey(jobId),
    },
    restored: true,
  };
}

async function generateTestcases({ generatorCode, solutionCode, testCount }) {
  const jobId = makeJobId();
  const { workDir, archivePath } = getJobPaths(jobId);
  await ensureDir(workDir);

  try {
    const generatorSource = path.join(workDir, "generator.cpp");
    const solutionSource = path.join(workDir, "solution.cpp");
    const generatorExe = path.join(
      workDir,
      process.platform === "win32" ? "generator.exe" : "generator",
    );
    const solutionExe = path.join(
      workDir,
      process.platform === "win32" ? "solution.exe" : "solution",
    );

    await fs.writeFile(generatorSource, generatorCode, "utf8");
    await fs.writeFile(solutionSource, solutionCode, "utf8");

    const generatorCompile = await compileCpp(
      generatorSource,
      generatorExe,
      workDir,
    );
    if (!generatorCompile.ok) {
      throw new AppError(
        422,
        "Generator compilation failed",
        "GENERATOR_COMPILE_ERROR",
        {
          stderr: generatorCompile.stderr,
        },
      );
    }

    const solutionCompile = await compileCpp(
      solutionSource,
      solutionExe,
      workDir,
    );
    if (!solutionCompile.ok) {
      throw new AppError(
        422,
        "Reference solution compilation failed",
        "SOLUTION_COMPILE_ERROR",
        {
          stderr: solutionCompile.stderr,
        },
      );
    }

    const generated = [];

    for (let i = 1; i <= testCount; i++) {
      const inputFile = path.join(workDir, `input_${i}.txt`);
      const outputFile = path.join(workDir, `output_${i}.txt`);

      const generatorRun = await runExecutable(generatorExe, workDir, {
        timeoutMs: env.GENERATOR_TIMEOUT_MS,
        stdoutPath: inputFile,
      });

      if (!generatorRun.ok) {
        throw new AppError(
          generatorRun.timedOut ? 408 : 422,
          generatorRun.timedOut
            ? "Generator execution timed out"
            : "Generator execution failed",
          generatorRun.timedOut
            ? "GENERATOR_TIMEOUT"
            : "GENERATOR_RUNTIME_ERROR",
          { testNumber: i, stderr: generatorRun.stderr },
        );
      }

      const inputBytes = await fileSize(inputFile);
      if (inputBytes > env.MAX_INPUT_BYTES_PER_FILE) {
        throw new AppError(
          413,
          "Generated input exceeds the per-file size limit",
          "INPUT_TOO_LARGE",
          {
            testNumber: i,
            bytes: inputBytes,
            maxBytes: env.MAX_INPUT_BYTES_PER_FILE,
          },
        );
      }

      const solutionRun = await runExecutable(solutionExe, workDir, {
        timeoutMs: env.SOLUTION_TIMEOUT_MS,
        stdinPath: inputFile,
        stdoutPath: outputFile,
      });

      if (!solutionRun.ok) {
        throw new AppError(
          solutionRun.timedOut ? 408 : 422,
          solutionRun.timedOut
            ? "Reference solution execution timed out"
            : "Reference solution execution failed",
          solutionRun.timedOut ? "SOLUTION_TIMEOUT" : "SOLUTION_RUNTIME_ERROR",
          { testNumber: i, stderr: solutionRun.stderr },
        );
      }

      const outputBytes = await fileSize(outputFile);
      if (outputBytes > env.MAX_INPUT_BYTES_PER_FILE) {
        throw new AppError(
          413,
          "Generated output exceeds the per-file size limit",
          "OUTPUT_TOO_LARGE",
          {
            testNumber: i,
            bytes: outputBytes,
            maxBytes: env.MAX_INPUT_BYTES_PER_FILE,
          },
        );
      }

      generated.push({
        testNumber: i,
        inputFile: path.basename(inputFile),
        outputFile: path.basename(outputFile),
        inputBytes,
        outputBytes,
      });
    }

    const totalBytes = generated.reduce(
      (sum, item) => sum + item.inputBytes + item.outputBytes,
      0,
    );

    if (totalBytes > env.MAX_TOTAL_BYTES) {
      throw new AppError(
        413,
        "Generated testcase artifacts exceed the total size limit",
        "TOTAL_OUTPUT_TOO_LARGE",
        {
          bytes: totalBytes,
          maxBytes: env.MAX_TOTAL_BYTES,
        },
      );
    }

    await createZip(workDir, archivePath);
    const archiveBytes = await fileSize(archivePath);

    // Durable copy. Local runtime remains a cache for fast local judging.
    const durable = await r2.uploadJob({
      jobId,
      workDir,
      generated,
      totalBytes,
      archiveBytes,
    });

    return {
      jobId,
      generated,
      totalBytes,
      archiveBytes,
      archivePath,
      workDir,
      archiveKey: durable.archiveKey,
      manifestKey: durable.manifestKey,
      storage: durable.storage,
    };
  } catch (error) {
    // A failed generation must not leave partial local artifacts. Successfully
    // uploaded R2 jobs are only created after all tests + ZIP are complete.
    await removeDir(workDir);
    throw error;
  }
}

async function getJobMetadata(jobId) {
  const local = await readLocalMetadata(jobId);
  if (local) {
    if (local.archiveBytes == null && r2.isConfigured()) {
      const remoteArchive = await r2.objectExists(r2.archiveKey(jobId));
      if (remoteArchive) {
        const manifest = await r2.readManifest(jobId);
        return {
          ...local,
          archiveBytes: manifest?.archiveBytes ?? null,
          archiveKey: manifest?.archiveKey || r2.archiveKey(jobId),
          remoteAvailable: true,
        };
      }
    }
    return {
      ...local,
      remoteAvailable: r2.isConfigured()
        ? await r2.objectExists(r2.archiveKey(jobId))
        : false,
    };
  }

  const manifest = await r2.readManifest(jobId);
  if (!manifest) {
    throw new AppError(404, "Testcase job not found", "TESTCASE_JOB_NOT_FOUND");
  }

  return {
    jobId,
    testCount: manifest.testCount || manifest.generated?.length || 0,
    generated: manifest.generated || [],
    totalBytes: manifest.totalBytes ?? null,
    archiveBytes: manifest.archiveBytes ?? null,
    archiveKey: manifest.archiveKey || r2.archiveKey(jobId),
    storage: "r2",
    localAvailable: false,
    remoteAvailable: true,
  };
}

async function rebuildArchive(jobId) {
  const { workDir, archivePath } = getJobPaths(jobId);
  const ensured = await ensureLocalJob(jobId);

  try {
    await fs.rm(archivePath, { force: true });
  } catch {}

  await createZip(workDir, archivePath);
  const archiveBytes = await fileSize(archivePath);

  // Re-upload the refreshed ZIP and manifest so R2 remains authoritative.
  const durable = await r2.uploadJob({
    jobId,
    workDir,
    generated: ensured.metadata.generated,
    totalBytes: ensured.metadata.totalBytes,
    archiveBytes,
  });

  return {
    ...ensured.metadata,
    archiveBytes,
    archiveKey: durable.archiveKey,
    storage: durable.storage,
  };
}

async function getJobTests(jobId) {
  const { workDir } = await ensureLocalJob(jobId);
  const entries = await fs.readdir(workDir);

  const inputFiles = entries
    .filter((name) => /^input_\d+\.txt$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  if (inputFiles.length === 0) {
    throw new AppError(
      404,
      "No testcase files found for job",
      "TESTCASES_NOT_FOUND",
    );
  }

  const tests = [];
  for (const inputFile of inputFiles) {
    const number = Number(inputFile.match(/\d+/)[0]);
    const outputFile = `output_${number}.txt`;
    const inputPath = resolveSafe(workDir, inputFile);
    const outputPath = resolveSafe(workDir, outputFile);
    try {
      const [input, expectedOutput] = await Promise.all([
        fs.readFile(inputPath, "utf8"),
        fs.readFile(outputPath, "utf8"),
      ]);
      tests.push({ input, expectedOutput });
    } catch {
      throw new AppError(
        404,
        `Missing testcase pair ${number}`,
        "TESTCASE_PAIR_NOT_FOUND",
      );
    }
  }

  return { jobId, tests };
}

async function ensureArchive(jobId) {
  const { workDir, archivePath } = getJobPaths(jobId);
  try {
    await fileSize(archivePath);
    return archivePath;
  } catch {}

  await ensureDir(workDir);
  if (await r2.restoreArchive(jobId, archivePath)) return archivePath;

  // If only the ZIP is missing but testcase pairs are available locally/R2,
  // rebuild it and make the durable copy healthy again.
  await rebuildArchive(jobId);
  return archivePath;
}

async function cleanup(jobId) {
  const { workDir } = getJobPaths(jobId);
  // Deliberately remove only the local cache. Durable R2 artifacts stay alive
  // because approved problems may still reference this jobId.
  await removeDir(workDir);
}

module.exports = {
  generateTestcases,
  getJobMetadata,
  rebuildArchive,
  getJobTests,
  ensureArchive,
  cleanup,
};
