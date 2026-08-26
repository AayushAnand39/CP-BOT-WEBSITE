const dotenv = require("dotenv");
const { z } = require("zod");
dotenv.config();
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4002),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  TRUST_PROXY: z.enum(["true", "false"]).default("true"),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}
module.exports = {
  env: parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((v) => v.trim())
    .filter(Boolean),
};
