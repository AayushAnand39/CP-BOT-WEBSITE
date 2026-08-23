const app = require("./app");
const { env } = require("./config/env");
const { connectDatabase, disconnectDatabase } = require("./services/db.service");
const { recoverLiveSimulationRuns, shutdownLiveScheduler } = require("./services/live-scheduler.service");

async function start() {
  try {
    await connectDatabase();
    await recoverLiveSimulationRuns();

    const server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`Bot Service listening on port ${env.PORT}`);
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
