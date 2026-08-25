const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { env, corsOrigins } = require("./config/env");
const routes = require("./routes/user.routes");
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
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const id = req.header("x-request-id") || crypto.randomUUID();
  req.id = id;
  res.setHeader("x-request-id", id);
  next();
});
const limiter = rateLimit({
  windowMs: env.USER_RATE_LIMIT_WINDOW_MS,
  limit: env.USER_RATE_LIMIT_MAX,
  skip(req) {
    const token = req.header("x-internal-service-token");
    return Boolean(token && token === env.INTERNAL_SERVICE_TOKEN);
  },
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many user-service requests. Please try again later.",
    code: "USER_RATE_LIMITED",
  },
});
app.get("/health", (_req, res) =>
  res.json({
    success: true,
    service: "user-service",
    status: "ok",
  }),
);
app.use("/api/v1/users", limiter, routes);
app.use(notFoundHandler);
app.use(errorHandler);
module.exports = app;
