const { z } = require("zod");
const service = require("../services/problem.service");
const AppError = require("../utils/app-error");

const uuid = z.string().uuid();
const status = z.enum(["DRAFT", "READY", "DISABLED"]);
const solutionSource = z.enum(["EDITORIAL", "CURATED", "EXTERNAL", "AI_GENERATED"]);

const examples = z.array(z.object({
  input: z.string(),
  output: z.string(),
  explanation: z.string().optional()
})).optional();

const list = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  ratingMin: z.coerce.number().int().min(0).max(5000).optional(),
  ratingMax: z.coerce.number().int().min(0).max(5000).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  concept: z.string().trim().min(1).max(50).optional(),
  source: z.string().trim().min(1).max(50).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  status: status.optional(),
  deterministic: z.enum(["true", "false"]).transform((v) => v === "true").optional()
}).refine(
  (v) => v.ratingMin === undefined || v.ratingMax === undefined || v.ratingMin <= v.ratingMax,
  { message: "ratingMin must be <= ratingMax", path: ["ratingMin"] }
);

// Keep the unrefined object separate so Zod v4 can safely build a PATCH schema.
const problemBase = z.object({
  source: z.string().trim().min(1).max(50).default("codeforces"),
  sourceContestId: z.number().int().positive().nullable().optional(),
  sourceIndex: z.string().trim().min(1).max(20).nullable().optional(),
  title: z.string().trim().min(1).max(300),
  rating: z.number().int().min(0).max(5000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).default([]),
  concepts: z.array(z.string().trim().min(1).max(50)).default([]),
  statement: z.string().min(1),
  inputFormat: z.string().nullable().optional(),
  outputFormat: z.string().nullable().optional(),
  constraints: z.string().nullable().optional(),
  examplesJson: examples,
  notes: z.string().nullable().optional(),
  editorial: z.string().nullable().optional(),
  timeLimitMs: z.number().int().positive().max(600000),
  memoryLimitMb: z.number().int().positive().max(65536),
  solutionCode: z.string().nullable().optional(),
  solutionSource: solutionSource.nullable().optional(),
  solutionSourceRef: z.string().max(500).nullable().optional(),
  generatorCode: z.string().nullable().optional(),
  generatorVersion: z.number().int().positive().nullable().optional(),
  testcaseArtifactJson: z.any().nullable().optional(),
  deterministic: z.boolean().default(false),
  status: status.default("DRAFT")
});

const create = problemBase.refine(
  (v) => v.status !== "READY" || (!!v.solutionCode && !!v.generatorCode && v.deterministic === true),
  { message: "READY requires solutionCode, generatorCode and deterministic=true", path: ["status"] }
);

const update = problemBase.partial();

function validate(schema, data, message, code) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(400, message, code, parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

async function listProblems(req, res) {
  const query = validate(list, req.query, "Invalid query parameters", "VALIDATION_ERROR");
  res.json({ success: true, data: await service.listProblems(query) });
}

async function get(req, res) {
  const id = validate(uuid, req.params.id, "Invalid problem id", "INVALID_PROBLEM_ID");
  res.json({ success: true, data: { problem: await service.getById(id) } });
}

async function internalGet(req, res) {
  const id = validate(uuid, req.params.id, "Invalid problem id", "INVALID_PROBLEM_ID");
  res.json({ success: true, data: { problem: await service.getById(id, true) } });
}

async function createProblem(req, res) {
  const data = validate(create, req.body, "Invalid problem data", "VALIDATION_ERROR");
  res.status(201).json({ success: true, data: { problem: await service.createProblem(data) } });
}

async function updateProblem(req, res) {
  const id = validate(uuid, req.params.id, "Invalid problem id", "INVALID_PROBLEM_ID");
  const data = validate(update, req.body, "Invalid problem data", "VALIDATION_ERROR");
  res.json({ success: true, data: { problem: await service.updateProblem(id, data) } });
}

async function removeProblem(req, res) {
  const id = validate(uuid, req.params.id, "Invalid problem id", "INVALID_PROBLEM_ID");
  await service.remove(id);
  res.status(204).send();
}

module.exports = {
  list: listProblems,
  get,
  internalGet,
  create: createProblem,
  update: updateProblem,
  remove: removeProblem
};
