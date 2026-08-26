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

  function normalizeUrl(value) {
    return value.replace(/\/+$/, "").toLowerCase();
  }

  const gatewayUrl =
    process.env.RENDER_EXTERNAL_URL
      ? normalizeUrl(process.env.RENDER_EXTERNAL_URL)
      : null;

  const seen = new Map();

  for (const [name, value] of Object.entries(serviceUrls)) {
    const normalized = normalizeUrl(value);
    const url = new URL(value);

    if (
      ["localhost", "127.0.0.1", "::1"].includes(
        url.hostname.toLowerCase()
      )
    ) {
      console.error(
        `[CONFIG ERROR] ${name} points to localhost: ${value}`
      );

      process.exit(1);
    }

    // Prevent Gateway -> Gateway recursion.
    if (gatewayUrl && normalized === gatewayUrl) {
      console.error(
        `[CONFIG ERROR] ${name} points back to API Gateway: ${value}`
      );

      process.exit(1);
    }

    // Catch accidentally duplicated service URLs.
    if (seen.has(normalized)) {
      console.error(
        `[CONFIG ERROR] ${name} and ${seen.get(
          normalized
        )} point to the same URL: ${value}`
      );

      process.exit(1);
    }

    seen.set(normalized, name);
  }

  console.log("[GATEWAY UPSTREAM CONFIG]", {
    AUTH_SERVICE_URL:
      parsed.data.AUTH_SERVICE_URL,
    USER_SERVICE_URL:
      parsed.data.USER_SERVICE_URL,
    PROBLEM_SERVICE_URL:
      parsed.data.PROBLEM_SERVICE_URL,
    CONTEST_SERVICE_URL:
      parsed.data.CONTEST_SERVICE_URL,
    BOT_SERVICE_URL:
      parsed.data.BOT_SERVICE_URL,
    AI_SERVICE_URL:
      parsed.data.AI_SERVICE_URL,
  });
}

module.exports = {
  env: parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean),
};
