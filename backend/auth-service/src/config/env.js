const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(4001),

  DATABASE_URL: z.string().min(1),

  USER_SERVICE_URL: z.string().url().default("http://localhost:4002"),

  INTERNAL_SERVICE_TOKEN: z.string().min(16),

  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),

  JWT_SECRET: z.string().min(32),

  JWT_EXPIRES_IN: z.string().default("7d"),

  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

  TRUST_PROXY: z.enum(["true", "false"]).default("true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = {
  env: parsed.data,

  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean),
};
