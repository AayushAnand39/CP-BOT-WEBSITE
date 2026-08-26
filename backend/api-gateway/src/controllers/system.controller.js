const { env } = require("../config/env");

const HEALTH_TIMEOUT_MS = 20_000;

async function checkService(name, baseUrl, required) {
  const startedAt = Date.now();
  const healthUrl = `${baseUrl.replace(/\/+$/, "")}/health`;

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      headers: {
        "x-warmup-request": "true",
        accept: "application/json",
      },
    });

    return {
      name,
      required,
      ready: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    console.warn("[WARMUP SERVICE ERROR]", {
      name,
      healthUrl,
      message: error?.message,
      durationMs: Date.now() - startedAt,
    });

    return {
      name,
      required,
      ready: false,
      status: null,
      error: error?.name === "TimeoutError" ? "WAKE_TIMEOUT" : "UNAVAILABLE",
      durationMs: Date.now() - startedAt,
    };
  }
}

async function warmup(req, res) {
  const startedAt = Date.now();

  // Warm every lightweight Render service in parallel. AI is useful for admin
  // flows but should never prevent the normal site/login/contest UI from
  // becoming available.
  const services = {
    auth: { url: env.AUTH_SERVICE_URL, required: true },
    user: { url: env.USER_SERVICE_URL, required: true },
    problem: { url: env.PROBLEM_SERVICE_URL, required: true },
    contest: { url: env.CONTEST_SERVICE_URL, required: true },
    bot: { url: env.BOT_SERVICE_URL, required: true },
    ai: { url: env.AI_SERVICE_URL, required: false },
  };

  console.log("[SYSTEM WARMUP START]", {
    requestId: req.id,
  });

  const results = await Promise.all(
    Object.entries(services).map(([name, config]) =>
      checkService(name, config.url, config.required),
    ),
  );

  const requiredReady = results
    .filter((service) => service.required)
    .every((service) => service.ready);

  const allReady = results.every((service) => service.ready);

  console.log("[SYSTEM WARMUP COMPLETE]", {
    requestId: req.id,
    requiredReady,
    allReady,
    durationMs: Date.now() - startedAt,
    services: results,
  });

  // WARMING is a valid state, not an HTTP failure. Returning 503 made Axios
  // reject the response and prevented the frontend from seeing which services
  // had already woken up.
  return res.status(200).json({
    success: true,
    ready: requiredReady,
    allReady,
    status: requiredReady ? "READY" : "WARMING",
    durationMs: Date.now() - startedAt,
    services: results,
  });
}

module.exports = {
  warmup,
};
