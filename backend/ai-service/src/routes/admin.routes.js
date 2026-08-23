const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../utils/async-handler");
const requireAdminGateway = require("../middleware/admin.middleware");
const { importProblem } = require("../services/import.service");
const manual = require("../services/manual-problem.service");
const AppError = require("../utils/app-error");

const router = express.Router();

const importSchema = z.object({
  problemCode: z.string().trim().min(2).max(20),
  testCount: z.number().int().min(1).max(50).optional()
});

const manualBaseSchema = z.object({
  title: z.string().trim().min(1).max(300),
  statement: z.string().trim().min(1).max(200000),
  constraints: z.string().trim().min(1).max(50000),
  inputFormat: z.string().trim().min(1).max(50000),
  outputFormat: z.string().trim().min(1).max(50000),
  solutionCode: z.string().trim().min(1).max(300000),
  rating: z.number().int().min(0).max(5000).nullable().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  timeLimitMs: z.number().int().positive().max(600000).optional(),
  memoryLimitMb: z.number().int().positive().max(65536).optional(),
  notes: z.string().max(50000).nullable().optional(),
  examples: z.array(z.object({ input: z.string().max(100000), output: z.string().max(100000), explanation: z.string().max(10000).optional() })).max(20).default([])
});

const manualPolishSchema = z.object({
  title: z.string().max(300).default(""),
  statement: z.string().max(200000).default(""),
  constraints: z.string().max(50000).default(""),
  inputFormat: z.string().max(50000).default(""),
  outputFormat: z.string().max(50000).default(""),
  examples: z.array(z.object({
    input: z.string().max(100000),
    output: z.string().max(100000),
    explanation: z.string().max(10000).optional()
  })).max(20).default([])
});

const manualTestcaseSchema = z.object({
  generatorCode: z.string().trim().min(1).max(300000),
  solutionCode: z.string().trim().min(1).max(300000),
  testCount: z.number().int().min(1).max(50).default(5)
});

const maintenanceContentSchema = manualPolishSchema.extend({
  title: z.string().trim().min(1).max(300),
  statement: z.string().trim().min(1).max(200000),
  constraints: z.string().max(50000),
  inputFormat: z.string().max(50000),
  outputFormat: z.string().max(50000)
});

const maintenanceRegenerateSchema = z.object({
  testCount: z.number().int().min(1).max(10).default(10)
});

const problemIdSchema = z.string().uuid();

const manualSubmitSchema = manualBaseSchema.extend({
  generatorCode: z.string().trim().min(1).max(300000),
  concepts: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  testcaseJob: z.object({
    jobId: z.string().regex(/^[0-9]+-[a-f0-9]+$/)
  }).nullable()
});

function parse(schema, body, message) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      400,
      message,
      "VALIDATION_ERROR",
      parsed.error.flatten().fieldErrors
    );
  }
  return parsed.data;
}

router.post(
  "/problems/import",
  requireAdminGateway,
  asyncHandler(async (req, res) => {
    const data = parse(importSchema, req.body, "Invalid import request");
    const result = await importProblem(data);
    res.status(201).json({ success: true, data: result });
  })
);

// Separate manual workflow. The existing Codeforces importer above is untouched.

router.post(
  "/problems/manual/polish",
  requireAdminGateway,
  asyncHandler(async (req, res) => {
    const data = parse(manualPolishSchema, req.body, "Invalid manual problem text");
    const result = await manual.polishProblem(data);
    res.json({ success: true, data: result });
  })
);


router.post(
  "/problems/manual/generator",
  requireAdminGateway,
  asyncHandler(async (req, res) => {
    const data = parse(manualBaseSchema, req.body, "Invalid manual problem data");
    const result = await manual.generateGenerator(data);
    res.json({ success: true, data: result });
  })
);

router.post(
  "/problems/manual/testcases",
  requireAdminGateway,
  asyncHandler(async (req, res) => {
    const data = parse(manualTestcaseSchema, req.body, "Invalid testcase request");
    const result = await manual.generateApprovedTestcases(data);
    res.status(201).json({ success: true, data: result });
  })
);

router.post(
  "/problems/manual/submit",
  requireAdminGateway,
  asyncHandler(async (req, res) => {
    const data = parse(manualSubmitSchema, req.body, "Invalid manual problem submission");
    const result = await manual.submitManualProblem(data);
    res.status(201).json({ success: true, data: result });
  })
);

router.get(
  "/problems/maintenance/:problemId",
  requireAdminGateway,
  asyncHandler(async (req, res) => {
    const problemId = parse(problemIdSchema, req.params.problemId, "Invalid problem id");
    const result = await manual.getProblemForMaintenance(problemId);
    res.json({ success: true, data: result });
  })
);

router.patch(
  "/problems/maintenance/:problemId",
  requireAdminGateway,
  asyncHandler(async (req, res) => {
    const problemId = parse(problemIdSchema, req.params.problemId, "Invalid problem id");
    const data = parse(maintenanceContentSchema, req.body, "Invalid problem content");
    const result = await manual.updateProblemContent(problemId, data);
    res.json({ success: true, data: result });
  })
);

router.post(
  "/problems/maintenance/:problemId/rebuild-archive",
  requireAdminGateway,
  asyncHandler(async (req, res) => {
    const problemId = parse(problemIdSchema, req.params.problemId, "Invalid problem id");
    const result = await manual.rebuildProblemArchive(problemId);
    res.json({ success: true, data: result });
  })
);

router.post(
  "/problems/maintenance/:problemId/regenerate-testcases",
  requireAdminGateway,
  asyncHandler(async (req, res) => {
    const problemId = parse(problemIdSchema, req.params.problemId, "Invalid problem id");
    const data = parse(maintenanceRegenerateSchema, req.body || {}, "Invalid testcase regeneration request");
    const result = await manual.regenerateProblemTestcases(problemId, data.testCount);
    res.status(201).json({ success: true, data: result });
  })
);

module.exports = router;
