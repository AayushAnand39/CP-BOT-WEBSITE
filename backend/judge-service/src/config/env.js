const dotenv = require("dotenv");
const { z } = require("zod");
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development","test","production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4007),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  JUDGE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  JUDGE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  JUDGE_WORK_DIR: z.string().default("./runtime"),
  MAX_CODE_BYTES: z.coerce.number().int().positive().default(1000000),
  MAX_TESTS_PER_SUBMISSION: z.coerce.number().int().positive().max(1000).default(100),
  MAX_INPUT_BYTES_PER_TEST: z.coerce.number().int().positive().default(104857600),
  MAX_OUTPUT_BYTES_PER_TEST: z.coerce.number().int().positive().default(1048576),
  COMPILE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  EXECUTION_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  TRUST_PROXY: z.enum(["true","false"]).default("false")
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}
module.exports = {
  env: parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map(v => v.trim()).filter(Boolean)
};
