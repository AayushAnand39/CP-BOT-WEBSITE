const app = require("./app");
const { env } = require("./config/env");
const { connectDatabase, disconnectDatabase } = require("./services/db.service");
const { recoverContestEndTimers, shutdownContestEndScheduler } = require("./services/contest-end-scheduler.service");
async function start() {
  try {
    await connectDatabase();
    await recoverContestEndTimers();
    const server = app.listen(env.PORT, "0.0.0.0", () => console.log(`Contest Service listening on port ${env.PORT}`));
    const shutdown = signal => {
      console.log(`${signal} received. Shutting down...`);
      shutdownContestEndScheduler();
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start Contest Service:", error);
    await disconnectDatabase();
    process.exit(1);
  }
}
start();
