const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateElo } = require("../src/services/rating.service");

test("equal ratings: win gives +16 with K=32", () => {
  const result = calculateElo({
    userRating: 1600,
    opponentRating: 1600,
    result: "WIN",
  });

  assert.equal(result.ratingDelta, 16);
  assert.equal(result.ratingAfter, 1616);
});

test("equal ratings: loss gives -16", () => {
  const result = calculateElo({
    userRating: 1600,
    opponentRating: 1600,
    result: "LOSS",
  });

  assert.equal(result.ratingDelta, -16);
  assert.equal(result.ratingAfter, 1584);
});

test("rating calculation is deterministic", () => {
  const args = {
    userRating: 1475,
    opponentRating: 1800,
    result: "WIN",
  };

  assert.deepEqual(calculateElo(args), calculateElo(args));
});
