const app = require("./app");
const { env } = require("./config/env");

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Testcase Service listening on port ${env.PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));