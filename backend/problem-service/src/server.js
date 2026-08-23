const app = require("./app");
const { env } = require("./config/env");
const {
  connectDatabase,
  disconnectDatabase,
} = require("./services/db.service");
async function start() {
  try {
    await connectDatabase();
    const server = app.listen(env.PORT, "0.0.0.0", () =>
      console.log(`Problem Service listening on port ${env.PORT}`),
    );
    const stop = (signal) => {
      console.log(`${signal} received. Shutting down...`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };
    process.on("SIGINT", () => stop("SIGINT"));
    process.on("SIGTERM", () => stop("SIGTERM"));
  } catch (e) {
    console.error(e);
    await disconnectDatabase();
    process.exit(1);
  }
}
start();
