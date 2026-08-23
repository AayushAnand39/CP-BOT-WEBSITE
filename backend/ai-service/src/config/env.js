const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4008),

  ADMIN_ORCHESTRATION_TOKEN: z.string().min(16),
  INTERNAL_SERVICE_TOKEN: z.string().min(16),

  PROBLEM_SERVICE_URL: z.string().url().default("http://localhost:4003"),
  TESTCASE_SERVICE_URL: z.string().url().default("http://localhost:4006"),
  JUDGE_SERVICE_URL: z.string().url().default("http://localhost:4007"),

  GROQ_API_KEY: z.string().optional().default(""),
  GROQ_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-120b"),

  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  TESTCASE_GENERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  CODEFORCES_API_GAP_MS: z.coerce.number().int().min(2000).default(2100),
  CODEFORCES_STATUS_PAGES: z.coerce.number().int().min(1).max(20).default(5),
  CODEFORCES_STATUS_PAGE_SIZE: z.coerce.number().int().min(10).max(1000).default(100),
  DEFAULT_TEST_COUNT: z.coerce.number().int().min(1).max(50).default(5)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = { env: parsed.data };
