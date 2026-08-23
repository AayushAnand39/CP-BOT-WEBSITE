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

const blockInternalRoutes = require("../src/middleware/internal-block.middleware");

function invoke(path) {
  return new Promise((resolve) => {
    const req = { path };
    blockInternalRoutes(req, {}, (error) => resolve(error));
  });
}

test("normal public route is allowed", async () => {
  const error = await invoke("/contests/abc");
  assert.equal(error, undefined);
});

test("literal internal path is blocked", async () => {
  const error = await invoke("/contests/internal/abc");
  assert.equal(error.statusCode, 404);
  assert.equal(error.code, "ROUTE_NOT_FOUND");
});

test("url-encoded internal path is blocked", async () => {
  const error = await invoke("/contests/%69nternal/abc");
  assert.equal(error.statusCode, 404);
});
