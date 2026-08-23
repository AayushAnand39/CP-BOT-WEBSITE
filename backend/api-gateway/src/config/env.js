const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  JWT_SECRET: z.string().min(32),

  AUTH_SERVICE_URL: z.string().url().default("http://localhost:4001"),
  USER_SERVICE_URL: z.string().url().default("http://localhost:4002"),
  PROBLEM_SERVICE_URL: z.string().url().default("http://localhost:4003"),
  CONTEST_SERVICE_URL: z.string().url().default("http://localhost:4004"),
  BOT_SERVICE_URL: z.string().url().default("http://localhost:4005"),
  AI_SERVICE_URL: z.string().url().default("http://localhost:4008"),
  ADMIN_EMAILS: z.string().default(""),
  ADMIN_ORCHESTRATION_TOKEN: z.string().min(16).default("change-me-admin-token"),

  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),

  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

  TRUST_PROXY: z.enum(["true", "false"]).default("false")
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = {
  env: parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
};
