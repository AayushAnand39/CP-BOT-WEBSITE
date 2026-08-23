const { env } = require("../config/env");
const AppError = require("../utils/app-error");

async function getTests(jobId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.TESTCASE_SERVICE_URL}/api/v1/testcases/internal/${encodeURIComponent(jobId)}/tests`, {
      signal: controller.signal,
      headers: { "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError(response.status >= 500 ? 502 : response.status, body.message || "Testcase Service request failed", body.code || "TESTCASE_SERVICE_ERROR", body.details);
    }
    return body.data?.tests || body.tests || [];
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, "Testcase Service unavailable", "TESTCASE_SERVICE_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { getTests };
