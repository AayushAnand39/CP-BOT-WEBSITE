const { env } = require("../config/env");
const { requestJson } = require("./http.service");
const AppError = require("../utils/app-error");

async function getProblem(problemId) {
  const body = await requestJson(`${env.PROBLEM_SERVICE_URL}/api/v1/problems/${problemId}`);
  const problem = body?.data?.problem;
  if (!problem) throw new AppError(502, "Problem Service returned no problem", "INVALID_PROBLEM_RESPONSE");
  return problem;
}

async function getProblemInternal(problemId) {
  const body = await requestJson(`${env.PROBLEM_SERVICE_URL}/api/v1/problems/internal/${problemId}`, {
    headers: { "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN }
  });
  const problem = body?.data?.problem;
  if (!problem) throw new AppError(502, "Problem Service returned no internal problem", "INVALID_PROBLEM_RESPONSE");
  return problem;
}

module.exports = { getProblem, getProblemInternal };
