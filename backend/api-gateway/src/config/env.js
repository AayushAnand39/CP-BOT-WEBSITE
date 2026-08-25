const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  JWT_SECRET: z.string().min(32),

  AUTH_SERVICE_URL: z.string().url().default("http://localhost:4001"),
  USER_SERVICE_URL: z.string().url().default("http://localhost:4002"),
  PROBLEM_SERVICE_URL: z.string().url().default("http://localhost:4003"),
  CONTEST_SERVICE_URL: z.string().url().default("http://localhost:4004"),
  BOT_SERVICE_URL: z.string().url().default("http://localhost:4005"),
  AI_SERVICE_URL: z.string().url().default("http://localhost:4008"),
  ADMIN_EMAILS: z.string().default(""),
  ADMIN_ORCHESTRATION_TOKEN: z
    .string()
    .min(16)
    .default("change-me-admin-token"),

  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(600000),

  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5000),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

  TRUST_PROXY: z.enum(["true", "false"]).default("true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === "production") {
  const serviceUrls = {
    AUTH_SERVICE_URL: parsed.data.AUTH_SERVICE_URL,
    USER_SERVICE_URL: parsed.data.USER_SERVICE_URL,
    PROBLEM_SERVICE_URL: parsed.data.PROBLEM_SERVICE_URL,
    CONTEST_SERVICE_URL: parsed.data.CONTEST_SERVICE_URL,
    BOT_SERVICE_URL: parsed.data.BOT_SERVICE_URL,
    AI_SERVICE_URL: parsed.data.AI_SERVICE_URL,
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
    .map((value) => value.trim())
    .filter(Boolean),
};
