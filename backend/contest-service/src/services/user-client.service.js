const { env } = require("../config/env");
const AppError = require("../utils/app-error");

async function applyChallengeResult({
  userId,
  eventId,
  opponentRating,
  result,
  statsDelta,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${env.USER_SERVICE_URL}/api/v1/users/internal/users/${encodeURIComponent(userId)}/challenge-results`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN,
        },
        body: JSON.stringify({
          eventId,
          opponentRating,
          result,
          statsDelta,
        }),
      },
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new AppError(
        response.status >= 500 ? 502 : response.status,
        body.message || "User Service challenge-result update failed",
        body.code || "USER_SERVICE_ERROR",
        body.details,
      );
    }

    return body.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error?.name === "AbortError") {
      throw new AppError(504, "User Service timed out", "USER_SERVICE_TIMEOUT");
    }
    console.error("[CONTEST -> USER ERROR]", {
      url: env.USER_SERVICE_URL,
      name: error?.name,
      message: error?.message,
      cause: error?.cause,
    });
    throw new AppError(
      502,
      "User Service unavailable",
      "USER_SERVICE_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  applyChallengeResult,
};
