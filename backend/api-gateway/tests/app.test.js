const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "test-jwt-secret-that-is-definitely-longer-than-32-characters";
process.env.AUTH_SERVICE_URL = "http://127.0.0.1:4101";
process.env.USER_SERVICE_URL = "http://127.0.0.1:4102";
process.env.PROBLEM_SERVICE_URL = "http://127.0.0.1:4103";
process.env.CONTEST_SERVICE_URL = "http://127.0.0.1:4104";
process.env.BOT_SERVICE_URL = "http://127.0.0.1:4105";
process.env.GLOBAL_RATE_LIMIT_MAX = "10000";

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
    assert.equal(body.service, "api-gateway");
  });
});

test("internal API is not exposed", async () => {
  await withServer(async (base) => {
    const response = await fetch(
      `${base}/api/v1/contests/internal/something`,
      { method: "POST" }
    );

    assert.equal(response.status, 404);

    const body = await response.json();
    assert.equal(body.code, "ROUTE_NOT_FOUND");
  });
});

test("protected user route is rejected before upstream call", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/v1/users/me`);
    assert.equal(response.status, 401);

    const body = await response.json();
    assert.equal(body.code, "AUTH_REQUIRED");
  });
});

test("unknown public route returns 404", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/v1/unknown`);
    assert.equal(response.status, 404);
  });
});
