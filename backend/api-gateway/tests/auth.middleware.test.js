const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "test-jwt-secret-that-is-definitely-longer-than-32-characters";
process.env.AUTH_SERVICE_URL = "http://127.0.0.1:4101";
process.env.USER_SERVICE_URL = "http://127.0.0.1:4102";
process.env.PROBLEM_SERVICE_URL = "http://127.0.0.1:4103";
process.env.CONTEST_SERVICE_URL = "http://127.0.0.1:4104";
process.env.BOT_SERVICE_URL = "http://127.0.0.1:4105";

const { requireAuth } = require("../src/middleware/auth.middleware");

function invoke(headers = {}) {
  return new Promise((resolve) => {
    const req = { headers };
    const res = {};
    requireAuth(req, res, (error) => resolve({ req, error }));
  });
}

test("missing bearer token is rejected", async () => {
  const { error } = await invoke();
  assert.equal(error.statusCode, 401);
  assert.equal(error.code, "AUTH_REQUIRED");
});

test("valid Auth Service JWT is accepted and propagated", async () => {
  const token = jwt.sign(
    {
      sub: "user-123",
      email: "user@example.com",
      type: "access"
    },
    process.env.JWT_SECRET,
    {
      issuer: "cp-bot-auth-service",
      audience: "cp-bot-platform",
      expiresIn: "1h"
    }
  );

  const { req, error } = await invoke({
    authorization: `Bearer ${token}`
  });

  assert.equal(error, undefined);
  assert.equal(req.auth.userId, "user-123");
  assert.equal(req.headers["x-auth-user-id"], "user-123");
  assert.equal(req.headers["x-auth-user-email"], "user@example.com");
});

test("wrong issuer JWT is rejected", async () => {
  const token = jwt.sign(
    {
      sub: "user-123",
      type: "access"
    },
    process.env.JWT_SECRET,
    {
      issuer: "wrong-service",
      audience: "cp-bot-platform",
      expiresIn: "1h"
    }
  );

  const { error } = await invoke({
    authorization: `Bearer ${token}`
  });

  assert.equal(error.statusCode, 401);
  assert.equal(error.code, "INVALID_TOKEN");
});
