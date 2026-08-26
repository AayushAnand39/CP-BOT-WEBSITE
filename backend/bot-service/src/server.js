const app = require("./app");
const { env } = require("./config/env");
const {
  connectDatabase,
  disconnectDatabase,
} = require("./services/db.service");
const {
  recoverLiveSimulationRuns,
  shutdownLiveScheduler,
} = require("./services/live-scheduler.service");

async function start() {
  try {
    await connectDatabase();

    // Bind the HTTP port before recovering scheduled runs. Recovery can call
    // Contest Service and may take a long time when another Render Free
    // service is cold. Waiting for it before listen() made /health unavailable,
    // which could keep Bot Service stuck in the warmup cycle.
    const server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`Bot Service listening on port ${env.PORT}`);
    });

    server.keepAliveTimeout = 120000;
    server.headersTimeout = 125000;

    recoverLiveSimulationRuns()
      .then((runs) => {
        console.log(`Recovered ${runs.length} live bot simulation run(s)`);
      })
      .catch((error) => {
        // Recovery failure must not make the whole HTTP service unavailable.
        console.error("Failed to recover live bot runs:", error);
      });

    async function shutdown(signal) {
      console.log(`${signal} received. Shutting down...`);
      shutdownLiveScheduler();

      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    }

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start Bot Service:", error);
    await disconnectDatabase();
    process.exit(1);
  }
}

start();
