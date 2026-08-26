const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
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

app.use("/api/v1/testcases", testcaseRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
