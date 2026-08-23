const test = require("node:test");
const assert = require("node:assert/strict");
const { parseProblemCode } = require("../src/utils/problem-code");

test("parses normal Codeforces problem code", () => {
  assert.deepEqual(parseProblemCode("2167A"), {
    problemCode: "2167A",
    contestId: 2167,
    problemIndex: "A"
  });
});

test("parses multi-character problem index", () => {
  assert.deepEqual(parseProblemCode("1234a1"), {
    problemCode: "1234A1",
    contestId: 1234,
    problemIndex: "A1"
  });
});

test("rejects invalid problem code", () => {
  assert.throws(() => parseProblemCode("ABC"));
});
