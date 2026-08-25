const dotenv = require("dotenv");
const { z } = require("zod");
dotenv.config();
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4004),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  INTERNAL_SERVICE_TOKEN: z.string().min(16),
  PROBLEM_SERVICE_URL: z.string().url().default("http://localhost:4003"),
  JUDGE_SERVICE_URL: z.string().url().default("http://localhost:4007"),
  TESTCASE_SERVICE_URL: z.string().url().default("http://localhost:4006"),
  BOT_SERVICE_URL: z.string().url().default("http://localhost:4005"),
  USER_SERVICE_URL: z.string().url().default("http://localhost:4002"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  TRUST_PROXY: z.enum(["true", "false"]).default("true"),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

if (parsed.data.NODE_ENV === "production") {
  const serviceUrls = {
    PROBLEM_SERVICE_URL: parsed.data.PROBLEM_SERVICE_URL,
    JUDGE_SERVICE_URL: parsed.data.JUDGE_SERVICE_URL,
    TESTCASE_SERVICE_URL: parsed.data.TESTCASE_SERVICE_URL,
    BOT_SERVICE_URL: parsed.data.BOT_SERVICE_URL,
    USER_SERVICE_URL: parsed.data.USER_SERVICE_URL,
  };

  for (const [name, value] of Object.entries(serviceUrls)) {
    const host = new URL(value).hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "::1"].includes(host)) {
      console.error(
        `Production configuration error: ${name} points to ${value}`,
      );
      process.exit(1);
    }
  }
}

module.exports = {
  env: parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((v) => v.trim())
    .filter(Boolean),
};
