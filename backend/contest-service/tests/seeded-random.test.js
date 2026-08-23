const test = require("node:test");
const assert = require("node:assert/strict");
const { seededShuffle } = require("../src/utils/seeded-random");
test("seeded shuffle is deterministic", () => {
  const input = ["a", "b", "c", "d", "e"];
  assert.deepEqual(seededShuffle(input, 12345), seededShuffle(input, 12345));
  assert.deepEqual(input, ["a", "b", "c", "d", "e"]);
});
