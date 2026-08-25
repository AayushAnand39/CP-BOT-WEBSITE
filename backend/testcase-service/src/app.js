const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const { env, corsOrigins } = require("./config/env");
const testcaseRoutes = require("./routes/testcase.routes");
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
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
  }),
);

app.use(express.json({ limit: "25mb" }));

app.use((req, res, next) => {
  const requestId = req.header("x-request-id") || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "testcase-service",
    status: "ok",
  });
});

const limiter = rateLimit({
  windowMs: env.TESTCASE_RATE_LIMIT_WINDOW_MS,
  limit: env.TESTCASE_RATE_LIMIT_MAX,
  skip(req) {
    const token = req.header("x-internal-service-token");

    return token && token === env.INTERNAL_SERVICE_TOKEN;
  },
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many testcase-generation requests. Please try again later.",
    code: "TESTCASE_RATE_LIMITED",
  },
});

app.use("/api/v1/testcases", limiter, testcaseRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
