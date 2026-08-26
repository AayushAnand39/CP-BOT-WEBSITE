const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");
const { corsOrigins } = require("./config/env");
const botRoutes = require("./routes/bot.routes");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

app.disable("x-powered-by");
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    }
  })
);

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const requestId = req.header("x-request-id") || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

app.use((req, res, next) => {
  const cfRay = req.header("cf-ray");

  res.setHeader(
    "x-cpbot-service",
    "bot-service"
  );

  console.log("[BOT INBOUND]", {
    method: req.method,
    path: req.originalUrl,
    cfRay,
    forwardedFor:
      req.header("x-forwarded-for"),
    time: new Date().toISOString(),
  });

  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "bot-service",
    status: "ok"
  });
});

app.use("/api/v1/bots", botRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
