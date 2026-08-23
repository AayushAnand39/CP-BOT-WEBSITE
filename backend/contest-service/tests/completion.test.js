const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/cpbot_contest_test?schema=public";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "test-secret-that-is-definitely-more-than-thirty-two-characters";
process.env.INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN ||
  "test-internal-token-123456";
process.env.PROBLEM_SERVICE_URL = "http://localhost:4003";
process.env.JUDGE_SERVICE_URL = "http://localhost:4007";
process.env.BOT_SERVICE_URL = "http://localhost:4005";
process.env.USER_SERVICE_URL = "http://localhost:4002";

const {
  compareUserToBot
} = require("../src/services/completion.service");

test("score wins before penalty", () => {
  assert.equal(
    compareUserToBot(
      { score: 3, penalty: 300 },
      { score: 2, penalty: 20 }
    ),
    "WIN"
  );
});

test("lower penalty wins on equal score", () => {
  assert.equal(
    compareUserToBot(
      { score: 2, penalty: 100 },
      { score: 2, penalty: 120 }
    ),
    "WIN"
  );
});

test("equal score and penalty is draw", () => {
  assert.equal(
    compareUserToBot(
      { score: 2, penalty: 100 },
      { score: 2, penalty: 100 }
    ),
    "DRAW"
  );
});
