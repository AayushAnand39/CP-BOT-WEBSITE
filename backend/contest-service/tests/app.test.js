process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/cpbot_contest?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "1234567890123456";
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");
test("GET /health", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.service, "contest-service");
});
test("internal contest creation requires token", async () => {
  const res = await request(app).post("/api/v1/contests/internal").send({});
  assert.equal(res.statusCode, 401);
});
test("join requires authentication", async () => {
  const res = await request(app).post("/api/v1/contests/00000000-0000-0000-0000-000000000000/join");
  assert.equal(res.statusCode, 401);
});
test("unknown route returns 404", async () => {
  const res = await request(app).get("/does-not-exist");
  assert.equal(res.statusCode, 404);
});
