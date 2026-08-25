const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");
const { corsOrigins } = require("./config/env");
const routes = require("./routes/contest.routes");
const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/error.middleware");
const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use((req, res, next) => {
  const startedAt = Date.now();

  console.log("[CONTEST REQUEST]", {
    method: req.method,
    path: req.originalUrl,
  });

  res.on("finish", () => {
    console.log("[CONTEST RESPONSE]", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  req.id = req.header("x-request-id") || crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
});
app.get("/health", (_req, res) =>
  res.json({ success: true, service: "contest-service", status: "ok" }),
);
app.use("/api/v1/contests", routes);
app.use(notFoundHandler);
app.use(errorHandler);
module.exports = app;
