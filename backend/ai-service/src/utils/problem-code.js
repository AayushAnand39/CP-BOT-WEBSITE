const AppError = require("./app-error");

function parseProblemCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  const match = normalized.match(/^(\d+)([A-Z][A-Z0-9]*)$/);

  if (!match) {
    throw new AppError(
      400,
      "Problem code must look like 2167A, 1915C or 1234A1",
      "INVALID_CODEFORCES_PROBLEM_CODE"
    );
  }

  return {
    problemCode: normalized,
    contestId: Number(match[1]),
    problemIndex: match[2]
  };
}

module.exports = { parseProblemCode };
