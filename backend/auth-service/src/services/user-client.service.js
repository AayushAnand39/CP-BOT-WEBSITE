const { env } = require("../config/env");
const AppError = require("../utils/app-error");

async function createProfile({ id, username, displayName }) {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${env.USER_SERVICE_URL}/api/v1/users/internal/users`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN,
        },
        body: JSON.stringify({
          id,
          username,
          displayName,
        }),
      },
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new AppError(
        response.status >= 500 ? 502 : response.status,
        body.message || "User profile creation failed",
        body.code || "USER_PROFILE_CREATION_FAILED",
        body.details,
      );
    }

    return body.data?.user ?? body.data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new AppError(
        504,
        "User Service timed out during registration",
        "USER_SERVICE_TIMEOUT",
      );
    }

    throw new AppError(
      502,
      "User Service is unavailable",
      "USER_SERVICE_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  createProfile,
};
