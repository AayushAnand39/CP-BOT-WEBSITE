const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4006),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  TESTCASE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  TESTCASE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  GENERATION_WORK_DIR: z.string().default("./runtime"),
  MAX_TEST_FILES: z.coerce.number().int().positive().max(1000).default(100),
  MAX_INPUT_BYTES_PER_FILE: z.coerce.number().int().positive().default(1024 * 1024 * 100),
  MAX_TOTAL_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),
  COMPILE_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  GENERATOR_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  SOLUTION_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  TRUST_PROXY: z.enum(["true", "false"]).default("false")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = {
  env: parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map(v => v.trim()).filter(Boolean)
};