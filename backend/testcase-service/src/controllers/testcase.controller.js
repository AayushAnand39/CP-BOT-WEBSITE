const { z } = require("zod");
const { env } = require("../config/env");
const AppError = require("../utils/app-error");
const testcaseService = require("../services/testcase.service");

const requestSchema = z.object({
  generatorCode: z.string().min(1).max(1_000_000),
  solutionCode: z.string().min(1).max(1_000_000),
  testCount: z.number().int().min(1).max(env.MAX_TEST_FILES),
});

async function generate(req, res) {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid testcase generation request",
      "VALIDATION_ERROR",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await testcaseService.generateTestcases(parsed.data);

  res.status(201).json({
    success: true,
    data: {
      jobId: result.jobId,
      generated: result.generated,
      totalBytes: result.totalBytes,
      archiveBytes: result.archiveBytes,
      archiveKey: result.archiveKey || null,
      storage: result.storage || "local",
    },
  });
}

async function downloadArchive(req, res) {
  const parsed = z
    .string()
    .regex(/^[0-9]+-[a-f0-9]+$/)
    .safeParse(req.params.jobId);

  if (!parsed.success) {
    throw new AppError(400, "Invalid job id", "INVALID_JOB_ID");
  }

  const archivePath = await testcaseService.ensureArchive(parsed.data);
  res.download(archivePath, `testcases-${parsed.data}.zip`);
}

async function getMetadata(req, res) {
  const parsed = z
    .string()
    .regex(/^[0-9]+-[a-f0-9]+$/)
    .safeParse(req.params.jobId);
  if (!parsed.success) {
    throw new AppError(400, "Invalid job id", "INVALID_JOB_ID");
  }

  const result = await testcaseService.getJobMetadata(parsed.data);
  res.json({ success: true, data: result });
}

async function rebuildArchive(req, res) {
  const parsed = z
    .string()
    .regex(/^[0-9]+-[a-f0-9]+$/)
    .safeParse(req.params.jobId);
  if (!parsed.success) {
    throw new AppError(400, "Invalid job id", "INVALID_JOB_ID");
  }

  const result = await testcaseService.rebuildArchive(parsed.data);
  res.json({ success: true, data: result });
}

async function getTests(req, res) {
  const parsed = z
    .string()
    .regex(/^[0-9]+-[a-f0-9]+$/)
    .safeParse(req.params.jobId);
  if (!parsed.success) {
    throw new AppError(400, "Invalid job id", "INVALID_JOB_ID");
  }
  const result = await testcaseService.getJobTests(parsed.data);
  res.json({ success: true, data: result });
}

async function cleanup(req, res) {
  const parsed = z
    .string()
    .regex(/^[0-9]+-[a-f0-9]+$/)
    .safeParse(req.params.jobId);
  if (!parsed.success) {
    throw new AppError(400, "Invalid job id", "INVALID_JOB_ID");
  }

  await testcaseService.cleanup(parsed.data);
  res.status(204).send();
}

module.exports = {
  generate,
  downloadArchive,
  getMetadata,
  rebuildArchive,
  getTests,
  cleanup,
};
