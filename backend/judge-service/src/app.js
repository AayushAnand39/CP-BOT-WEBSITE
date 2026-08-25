const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { env, corsOrigins } = require("./config/env");
const judgeRoutes = require("./routes/judge.routes");
const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/error.middleware");

const app = express();
if (env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "100mb" }));
app.use((req, res, next) => {
  const requestId = req.header("x-request-id") || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});
app.get("/health", (_req, res) =>
  res.json({ success: true, service: "judge-service", status: "ok" }),
);
app.use((req, res, next) => {
  const startedAt = Date.now();

  console.log("[JUDGE REQUEST]", {
    method: req.method,
    path: req.originalUrl,
  });

  res.on("finish", () => {
    console.log("[JUDGE RESPONSE]", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});
app.use(
  "/api/v1/judge",
  rateLimit({
    windowMs: env.JUDGE_RATE_LIMIT_WINDOW_MS,
    limit: env.JUDGE_RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many judging requests. Please try again later.",
      code: "JUDGE_RATE_LIMITED",
    },
  }),
  judgeRoutes,
);
app.use(notFoundHandler);
app.use(errorHandler);
module.exports = app;
