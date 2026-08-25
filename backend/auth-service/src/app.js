const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");

const {
  corsOrigins,
  env
} = require("./config/env");

const authRoutes = require("./routes/auth.routes");

const {
  notFoundHandler,
  errorHandler
} = require("./middleware/error.middleware");

const app = express();

if (env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origin not allowed by CORS")
      );
    }
  })
);

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use((req, res, next) => {
  const requestId =
    req.header("x-request-id") ||
    crypto.randomUUID();

  req.id = requestId;

  res.setHeader(
    "x-request-id",
    requestId
  );

  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "auth-service",
    status: "ok"
  });
});

app.use(
  "/api/v1/auth",
  authRoutes
);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;