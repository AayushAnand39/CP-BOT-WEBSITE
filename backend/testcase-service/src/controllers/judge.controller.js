const { z } = require("zod");
const { env } = require("../config/env");
const AppError = require("../utils/app-error");
const { judgeSubmission, runCode } = require("../services/execution.service");
const testSchema = z.object({ input: z.string(), expectedOutput: z.string() });
const timeoutSchema = z.number().int().min(250).max(30000).optional();
const submissionSchema = z.object({
  language: z.literal("cpp"),
  sourceCode: z.string().min(1).max(env.MAX_CODE_BYTES),
  tests: z.array(testSchema).min(1).max(env.MAX_TESTS_PER_SUBMISSION),
  executionTimeoutMs: timeoutSchema,
});
const runSchema = z.object({
  language: z.literal("cpp"),
  sourceCode: z.string().min(1).max(env.MAX_CODE_BYTES),
  input: z.string().default(""),
  expectedOutput: z.string().optional(),
  executionTimeoutMs: timeoutSchema,
});
function parse(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new AppError(
      400,
      "Invalid submission data",
      "VALIDATION_ERROR",
      parsed.error.flatten().fieldErrors,
    );
  return parsed.data;
}
async function judge(req, res) {
  const data = parse(submissionSchema, req.body);
  const result = await judgeSubmission({
    code: data.sourceCode,
    tests: data.tests,
    executionTimeoutMs: data.executionTimeoutMs,
  });
  res.status(200).json({ success: true, data: result });
}
async function run(req, res) {
  const data = parse(runSchema, req.body);
  const result = await runCode({
    code: data.sourceCode,
    input: data.input,
    expectedOutput: data.expectedOutput,
    executionTimeoutMs: data.executionTimeoutMs,
  });
  res.status(200).json({ success: true, data: result });
}
module.exports = { judge, run };
