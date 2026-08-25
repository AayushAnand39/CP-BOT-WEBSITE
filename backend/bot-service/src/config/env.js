const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4005),
  DATABASE_URL: z.string().min(1),
  INTERNAL_SERVICE_TOKEN: z.string().min(16),
  CONTEST_SERVICE_URL: z.string().url().default("http://localhost:4004"),
  PROBLEM_SERVICE_URL: z.string().url().default("http://localhost:4003"),
  AI_SERVICE_URL: z.string().url().default("http://localhost:4008"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  BOT_AI_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === "production") {
  const serviceUrls = {
    CONTEST_SERVICE_URL: parsed.data.CONTEST_SERVICE_URL,
    PROBLEM_SERVICE_URL: parsed.data.PROBLEM_SERVICE_URL,
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
