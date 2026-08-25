const { env } = require("../config/env");
const AppError = require("../utils/app-error");

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.BOT_SERVICE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(options.internal
          ? { "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN }
          : {}),
        ...(options.headers || {}),
      },
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new AppError(
        response.status >= 500 ? 502 : response.status,
        body.message || "Bot Service request failed",
        body.code || "BOT_SERVICE_ERROR",
        body.details,
      );
    }

    return body.data ?? body;
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error?.name === "AbortError") {
      throw new AppError(504, "Bot Service timed out", "BOT_SERVICE_TIMEOUT");
    }

    console.error("[CONTEST -> BOT NETWORK ERROR]", {
      path,
      url: `${env.BOT_SERVICE_URL}${path}`,
      name: error?.name,
      message: error?.message,
      cause: error?.cause,
    });

    throw new AppError(
      502,
      "Bot Service unavailable",
      "BOT_SERVICE_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function getBot(botId) {
  const data = await request(`/api/v1/bots/${encodeURIComponent(botId)}`);

  return data.bot ?? data;
}

async function createSimulationPlan({ botId, contestId, seed }) {
  const data = await request(
    `/api/v1/bots/internal/${encodeURIComponent(botId)}/simulations`,
    {
      method: "POST",
      internal: true,
      body: JSON.stringify({
        contestId,
        seed,
      }),
    },
  );

  return data.simulation ?? data;
}

async function finishLiveSimulation(runId) {
  return request(
    `/api/v1/bots/internal/simulations/${encodeURIComponent(runId)}/finish-now`,
    { method: "POST", internal: true },
  );
}

async function startLiveSimulation(runId) {
  return request(
    `/api/v1/bots/internal/simulations/${encodeURIComponent(runId)}/start-live`,
    {
      method: "POST",
      internal: true,
    },
  );
}

module.exports = {
  getBot,
  createSimulationPlan,
  startLiveSimulation,
  finishLiveSimulation,
};
