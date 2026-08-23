const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { env } = require("../config/env");
const AppError = require("../utils/app-error");
const { ensureDir, removeDir, resolveSafe } = require("./file.service");
const { compileCpp, runExecutable } = require("./command.service");
const { createZip, getArchivePath } = require("./archive.service");

function makeJobId() {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

async function fileSize(filePath) {
  const stat = await fs.stat(filePath);
  return stat.size;
}

async function generateTestcases({ generatorCode, solutionCode, testCount }) {
  const jobId = makeJobId();
  const root = path.resolve(env.GENERATION_WORK_DIR);
  const workDir = resolveSafe(root, jobId);
  await ensureDir(workDir);

  try {
    const generatorSource = path.join(workDir, "generator.cpp");
    const solutionSource = path.join(workDir, "solution.cpp");
    const generatorExe = path.join(workDir, process.platform === "win32" ? "generator.exe" : "generator");
    const solutionExe = path.join(workDir, process.platform === "win32" ? "solution.exe" : "solution");

    await fs.writeFile(generatorSource, generatorCode, "utf8");
    await fs.writeFile(solutionSource, solutionCode, "utf8");

    const generatorCompile = await compileCpp(generatorSource, generatorExe, workDir);
    if (!generatorCompile.ok) {
      throw new AppError(422, "Generator compilation failed", "GENERATOR_COMPILE_ERROR", {
        stderr: generatorCompile.stderr
      });
    }

    const solutionCompile = await compileCpp(solutionSource, solutionExe, workDir);
    if (!solutionCompile.ok) {
      throw new AppError(422, "Reference solution compilation failed", "SOLUTION_COMPILE_ERROR", {
        stderr: solutionCompile.stderr
      });
    }

    const generated = [];

    for (let i = 1; i <= testCount; i++) {
      const inputFile = path.join(workDir, `input_${i}.txt`);
      const outputFile = path.join(workDir, `output_${i}.txt`);

      const generatorRun = await runExecutable(generatorExe, workDir, {
        timeoutMs: env.GENERATOR_TIMEOUT_MS,
        stdoutPath: inputFile
      });

      if (!generatorRun.ok) {
        throw new AppError(
          generatorRun.timedOut ? 408 : 422,
          generatorRun.timedOut ? "Generator execution timed out" : "Generator execution failed",
          generatorRun.timedOut ? "GENERATOR_TIMEOUT" : "GENERATOR_RUNTIME_ERROR",
          { testNumber: i, stderr: generatorRun.stderr }
        );
      }

      const inputBytes = await fileSize(inputFile);
      if (inputBytes > env.MAX_INPUT_BYTES_PER_FILE) {
        throw new AppError(413, "Generated input exceeds the per-file size limit", "INPUT_TOO_LARGE", {
          testNumber: i, bytes: inputBytes, maxBytes: env.MAX_INPUT_BYTES_PER_FILE
        });
      }

      const solutionRun = await runExecutable(solutionExe, workDir, {
        timeoutMs: env.SOLUTION_TIMEOUT_MS,
        stdinPath: inputFile,
        stdoutPath: outputFile
      });

      if (!solutionRun.ok) {
        throw new AppError(
          solutionRun.timedOut ? 408 : 422,
          solutionRun.timedOut ? "Reference solution execution timed out" : "Reference solution execution failed",
          solutionRun.timedOut ? "SOLUTION_TIMEOUT" : "SOLUTION_RUNTIME_ERROR",
          { testNumber: i, stderr: solutionRun.stderr }
        );
      }

      const outputBytes = await fileSize(outputFile);
      if (outputBytes > env.MAX_INPUT_BYTES_PER_FILE) {
        throw new AppError(413, "Generated output exceeds the per-file size limit", "OUTPUT_TOO_LARGE", {
          testNumber: i, bytes: outputBytes, maxBytes: env.MAX_INPUT_BYTES_PER_FILE
        });
      }

      generated.push({
        testNumber: i,
        inputFile: path.basename(inputFile),
        outputFile: path.basename(outputFile),
        inputBytes,
        outputBytes
      });
    }

    const totalBytes = generated.reduce(
      (sum, item) => sum + item.inputBytes + item.outputBytes, 0
    );

    if (totalBytes > env.MAX_TOTAL_BYTES) {
      throw new AppError(413, "Generated testcase artifacts exceed the total size limit", "TOTAL_OUTPUT_TOO_LARGE", {
        bytes: totalBytes, maxBytes: env.MAX_TOTAL_BYTES
      });
    }

    const archivePath = getArchivePath(workDir);
    await createZip(workDir, archivePath);

    const archiveBytes = await fileSize(archivePath);

    return { jobId, generated, totalBytes, archiveBytes, archivePath, workDir };
  } catch (error) {
    await removeDir(workDir);
    throw error;
  }
}


async function getJobMetadata(jobId) {
  const root = path.resolve(env.GENERATION_WORK_DIR);
  const workDir = resolveSafe(root, jobId);

  let entries;
  try {
    entries = await fs.readdir(workDir);
  } catch {
    throw new AppError(404, "Testcase job not found", "TESTCASE_JOB_NOT_FOUND");
  }

  const inputFiles = entries
    .filter((name) => /^input_\d+\.txt$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  if (inputFiles.length === 0) {
    throw new AppError(404, "No testcase files found for job", "TESTCASES_NOT_FOUND");
  }

  const generated = [];
  for (const inputFile of inputFiles) {
    const testNumber = Number(inputFile.match(/\d+/)[0]);
    const outputFile = `output_${testNumber}.txt`;
    const inputPath = resolveSafe(workDir, inputFile);
    const outputPath = resolveSafe(workDir, outputFile);

    try {
      const [inputBytes, outputBytes] = await Promise.all([
        fileSize(inputPath),
        fileSize(outputPath)
      ]);
      generated.push({ testNumber, inputFile, outputFile, inputBytes, outputBytes });
    } catch {
      throw new AppError(404, `Missing testcase pair ${testNumber}`, "TESTCASE_PAIR_NOT_FOUND");
    }
  }

  const totalBytes = generated.reduce(
    (sum, item) => sum + item.inputBytes + item.outputBytes,
    0
  );

  const archivePath = getArchivePath(workDir);
  let archiveBytes = null;
  try {
    archiveBytes = await fileSize(archivePath);
  } catch {
    // Metadata is still useful if the archive was not created or was removed.
  }

  return {
    jobId,
    testCount: generated.length,
    generated,
    totalBytes,
    archiveBytes
  };
}

async function rebuildArchive(jobId) {
  const root = path.resolve(env.GENERATION_WORK_DIR);
  const workDir = resolveSafe(root, jobId);

  const metadata = await getJobMetadata(jobId);
  const archivePath = getArchivePath(workDir);

  try {
    await fs.rm(archivePath, { force: true });
  } catch {}

  await createZip(workDir, archivePath);
  const archiveBytes = await fileSize(archivePath);

  return { ...metadata, archiveBytes };
}

async function getJobTests(jobId) {
  const root = path.resolve(env.GENERATION_WORK_DIR);
  const workDir = resolveSafe(root, jobId);

  let entries;
  try {
    entries = await fs.readdir(workDir);
  } catch {
    throw new AppError(404, "Testcase job not found", "TESTCASE_JOB_NOT_FOUND");
  }

  const inputFiles = entries
    .filter((name) => /^input_\d+\.txt$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  if (inputFiles.length === 0) {
    throw new AppError(404, "No testcase files found for job", "TESTCASES_NOT_FOUND");
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
        fs.readFile(outputPath, "utf8")
      ]);
      tests.push({ input, expectedOutput });
    } catch {
      throw new AppError(404, `Missing testcase pair ${number}`, "TESTCASE_PAIR_NOT_FOUND");
    }
  }

  return { jobId, tests };
}

async function cleanup(jobId) {
  const root = path.resolve(env.GENERATION_WORK_DIR);
  const workDir = resolveSafe(root, jobId);
  await removeDir(workDir);
}

module.exports = { generateTestcases, getJobMetadata, rebuildArchive, getJobTests, cleanup };