const { env } = require("../config/env");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkService(name, baseUrl) {
  const attempts = 5;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(30000),
        headers: {
          "x-warmup-request": "true",
        },
      });

      if (response.ok) {
        return {
          name,
          ready: true,
          attempt,
          status: response.status,
        };
      }

      console.warn("[WARMUP SERVICE NOT READY]", {
        name,
        attempt,
        status: response.status,
      });
    } catch (error) {
      console.warn("[WARMUP SERVICE ERROR]", {
        name,
        attempt,
        message: error?.message,
      });
    }

    if (attempt < attempts) {
      await sleep(Math.min(3000 * attempt, 10000));
    }
  }

  return {
    name,
    ready: false,
  };
}

async function warmup(req, res) {
  const startedAt = Date.now();

  const services = {
    auth: env.AUTH_SERVICE_URL,
    user: env.USER_SERVICE_URL,
    problem: env.PROBLEM_SERVICE_URL,
    contest: env.CONTEST_SERVICE_URL,
    bot: env.BOT_SERVICE_URL,
    ai: env.AI_SERVICE_URL,
  };

  console.log("[SYSTEM WARMUP START]", {
    requestId: req.id,
  });

  const results = await Promise.all(
    Object.entries(services).map(([name, url]) => checkService(name, url)),
  );

  const allReady = results.every((service) => service.ready);

  console.log("[SYSTEM WARMUP COMPLETE]", {
    requestId: req.id,
    allReady,
    durationMs: Date.now() - startedAt,
    services: results,
  });

  return res.status(allReady ? 200 : 503).json({
    success: allReady,
    status: allReady ? "READY" : "PARTIALLY_READY",
    durationMs: Date.now() - startedAt,
    services: results,
  });
}

module.exports = {
  warmup,
};
