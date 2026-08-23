const test = require("node:test");
const assert = require("node:assert/strict");
const { createRandom } = require("../src/utils/deterministic-random");

test("same seed parts produce same random sequence", () => {
  const a = createRandom(["bot", "contest", "problem"]);
  const b = createRandom(["bot", "contest", "problem"]);

  const seqA = Array.from({ length: 8 }, () => a());
  const seqB = Array.from({ length: 8 }, () => b());

  assert.deepEqual(seqA, seqB);
});

test("different seed parts change random sequence", () => {
  const a = createRandom(["bot", "contest", "problem-a"]);
  const b = createRandom(["bot", "contest", "problem-b"]);
  assert.notEqual(a(), b());
});
