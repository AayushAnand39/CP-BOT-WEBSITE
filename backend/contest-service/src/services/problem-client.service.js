const { env } = require("../config/env");
const AppError = require("../utils/app-error");

async function request(path, { internal = false, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.PROBLEM_SERVICE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(internal ? { "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN } : {}),
        ...(options.headers || {})
      }
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError(
        response.status >= 500 ? 502 : response.status,
        body.message || "Problem Service request failed",
        body.code || "PROBLEM_SERVICE_ERROR",
        { status: response.status, details: body.details }
      );
    }

    return body.data ?? body;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, "Problem Service unavailable", "PROBLEM_SERVICE_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

async function getEligibleProblems({ ratingMin, ratingMax }) {
  const qs = new URLSearchParams({
    status: "READY",
    deterministic: "true",
    ratingMin: String(ratingMin),
    ratingMax: String(ratingMax),
    pageSize: "100"
  });
  const data = await request(`/api/v1/problems?${qs}`);
  return Array.isArray(data) ? data : (data.items || data.problems || []);
}

async function getProblemPublic(problemId) {
  const data = await request(`/api/v1/problems/${encodeURIComponent(problemId)}`);
  return data.problem || data;
}

async function getProblemInternal(problemId) {
  const data = await request(
    `/api/v1/problems/internal/${encodeURIComponent(problemId)}`,
    { internal: true }
  );
  return data.problem || data;
}

module.exports = { getEligibleProblems, getProblemPublic, getProblemInternal };
