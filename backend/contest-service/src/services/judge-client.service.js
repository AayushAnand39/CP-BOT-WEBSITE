const { env } = require("../config/env");
const AppError = require("../utils/app-error");

async function request(path, payload) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    env.REQUEST_TIMEOUT_MS * 6,
  );

  try {
    const response = await fetch(`${env.JUDGE_SERVICE_URL}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("[CONTEST -> JUDGE HTTP ERROR]", {
        path,
        status: response.status,
        code: body.code,
        message: body.message,
      });

      throw new AppError(
        response.status >= 500 ? 502 : response.status,

        body.message || "Judge Service request failed",

        body.code || "JUDGE_SERVICE_ERROR",

        {
          upstreamStatus: response.status,
          details: body.details,
        },
      );
    }

    return body.data ?? body;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw new AppError(
        504,
        "Judge Service timed out",
        "JUDGE_SERVICE_TIMEOUT",
      );
    }

    console.error("[CONTEST -> JUDGE NETWORK ERROR]", {
      path,
      url: `${env.JUDGE_SERVICE_URL}${path}`,
      name: error?.name,
      message: error?.message,
      cause: error?.cause,
    });

    throw new AppError(
      502,
      "Judge Service unavailable",
      "JUDGE_SERVICE_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function judgeSubmission(payload) {
  return request("/api/v1/judge/internal/judge", payload);
}

async function runCode(payload) {
  return request("/api/v1/judge/internal/run", payload);
}

module.exports = {
  judgeSubmission,
  runCode,
};
