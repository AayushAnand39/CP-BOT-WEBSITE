const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/cpbot_bot_test?schema=public";
process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "test-internal-token-123456";
process.env.CONTEST_SERVICE_URL = process.env.CONTEST_SERVICE_URL || "http://localhost:4004";
process.env.PROBLEM_SERVICE_URL = process.env.PROBLEM_SERVICE_URL || "http://localhost:4003";

const app = require("../src/app");

async function withServer(fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /health", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.service, "bot-service");
  });
});

test("unknown route returns 404", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/missing`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.code, "ROUTE_NOT_FOUND");
  });
});

test("internal create rejects missing service token before database access", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/v1/bots/internal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "test-bot",
        name: "Test Bot",
        rating: 1500
      })
    });
    assert.equal(response.status, 401);
  });
});
