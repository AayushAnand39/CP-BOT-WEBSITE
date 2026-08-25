const dotenv = require("dotenv");
const { z } = require("zod");
dotenv.config();
const s = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4003),
  DATABASE_URL: z.string().min(1),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  PROBLEM_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(900000),
  PROBLEM_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5000),
  TRUST_PROXY: z.enum(["true", "false"]).default("true"),
});
const p = s.safeParse(process.env);
if (!p.success) {
  console.error(p.error.flatten().fieldErrors);
  process.exit(1);
}
module.exports = {
  env: p.data,
  corsOrigins: p.data.CORS_ORIGINS.split(",")
    .map((v) => v.trim())
    .filter(Boolean),
};
