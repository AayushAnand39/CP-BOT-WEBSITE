const { env } = require("../config/env");
const { postJson } = require("../utils/http");
const AppError = require("../utils/app-error");

const internalHeaders = () => ({
  "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN
});

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(
      response.status >= 500 ? 502 : response.status,
      body.message || "Internal service request failed",
      body.code || "INTERNAL_SERVICE_ERROR",
      body.details
    );
  }
  return body;
}

async function judgeSamples(solutionCode, examples) {
  if (!examples?.length) return { verdict: "SKIPPED_NO_SAMPLES" };
  const payload = await postJson(
    `${env.JUDGE_SERVICE_URL}/api/v1/judge/internal/judge`,
    {
      language: "cpp",
      sourceCode: solutionCode,
      tests: examples.map((sample) => ({
        input: sample.input.endsWith("\n") ? sample.input : `${sample.input}\n`,
        expectedOutput: sample.output.endsWith("\n") ? sample.output : `${sample.output}\n`
      }))
    },
    internalHeaders()
  );
  const result = payload.data || payload;
  const verdict = result.verdict || result.status;
  if (verdict !== "AC" && verdict !== "Accepted") {
    throw new AppError(422, "Reference solution failed sample tests", "REFERENCE_SOLUTION_SAMPLE_VALIDATION_FAILED", result);
  }
  return result;
}

async function generateTestcases(generatorCode, solutionCode, testCount) {
  const payload = await postJson(
    `${env.TESTCASE_SERVICE_URL}/api/v1/testcases/internal/generate`,
    { generatorCode, solutionCode, testCount },
    internalHeaders(),
    env.TESTCASE_GENERATION_TIMEOUT_MS
  );
  return payload.data || payload;
}

async function getTestcaseMetadata(jobId) {
  const payload = await requestJson(
    `${env.TESTCASE_SERVICE_URL}/api/v1/testcases/internal/${encodeURIComponent(jobId)}/metadata`,
    { headers: internalHeaders() }
  );
  return payload.data || payload;
}

async function rebuildTestcaseArchive(jobId) {
  const payload = await postJson(
    `${env.TESTCASE_SERVICE_URL}/api/v1/testcases/internal/${encodeURIComponent(jobId)}/rebuild-archive`,
    {},
    internalHeaders()
  );
  return payload.data || payload;
}

async function getInternalProblem(problemId) {
  const payload = await requestJson(
    `${env.PROBLEM_SERVICE_URL}/api/v1/problems/internal/${encodeURIComponent(problemId)}`,
    { headers: internalHeaders() }
  );
  return payload.data?.problem || payload.data || payload.problem || payload;
}

async function updateProblem(problemId, patch) {
  const payload = await requestJson(
    `${env.PROBLEM_SERVICE_URL}/api/v1/problems/internal/${encodeURIComponent(problemId)}`,
    {
      method: "PATCH",
      headers: {
        ...internalHeaders(),
        "content-type": "application/json"
      },
      body: JSON.stringify(patch)
    }
  );
  return payload.data?.problem || payload.data || payload.problem || payload;
}

async function persistProblem(problem) {
  const payload = await postJson(
    `${env.PROBLEM_SERVICE_URL}/api/v1/problems/internal`,
    problem,
    internalHeaders()
  );
  return payload.data?.problem || payload.data || payload.problem || payload;
}

module.exports = { judgeSamples, generateTestcases, getTestcaseMetadata, rebuildTestcaseArchive, getInternalProblem, updateProblem, persistProblem };
