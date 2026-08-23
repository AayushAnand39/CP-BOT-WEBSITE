const app = require("./app");

const {
  env
} = require("./config/env");

const {
  connectDatabase,
  disconnectDatabase
} = require("./services/db.service");

async function start() {
  try {
    await connectDatabase();

    const server = app.listen(
      env.PORT,
      () => {
        console.log(
          `Auth Service listening on port ${env.PORT}`
        );
      }
    );

    const shutdown = async (signal) => {
      console.log(
        `${signal} received. Shutting down...`
      );

      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };

    process.on(
      "SIGINT",
      () => shutdown("SIGINT")
    );

    process.on(
      "SIGTERM",
      () => shutdown("SIGTERM")
    );

  } catch (error) {
    console.error(
      "Failed to start Auth Service:",
      error
    );

    await disconnectDatabase();

    process.exit(1);
  }
}

start();