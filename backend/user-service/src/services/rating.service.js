const K_FACTOR = 32;

function expectedScore(userRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - userRating) / 400));
}

function resultScore(result) {
  if (result === "WIN") return 1;
  if (result === "DRAW") return 0.5;
  return 0;
}

function calculateElo({ userRating, opponentRating, result }) {
  const expected = expectedScore(userRating, opponentRating);
  const actual = resultScore(result);
  const delta = Math.round(K_FACTOR * (actual - expected));

  return {
    expectedScore: expected,
    actualScore: actual,
    ratingBefore: userRating,
    ratingDelta: delta,
    ratingAfter: Math.max(0, Math.min(5000, userRating + delta)),
  };
}

module.exports = {
  K_FACTOR,
  expectedScore,
  calculateElo,
};
