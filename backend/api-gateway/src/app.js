const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { env, corsOrigins } = require("./config/env");
const requestIdMiddleware = require("./middleware/request-id.middleware");
const blockInternalRoutes = require("./middleware/internal-block.middleware");
const { globalLimiter } = require("./middleware/rate-limit.middleware");
const gatewayRoutes = require("./routes/gateway.routes");
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

// app.use((req, res, next) => {
//   const startedAt = Date.now();

//   console.log("[GATEWAY REQUEST]", {
//     method: req.method,
//     path: req.originalUrl,
//     origin: req.headers.origin,
//   });

//   res.on("finish", () => {
//     console.log("[GATEWAY RESPONSE]", {
//       method: req.method,
//       path: req.originalUrl,
//       status: res.statusCode,
//       durationMs: Date.now() - startedAt,
//     });
//   });

//   next();
// });

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origin not allowed by CORS")
      );
    },
    credentials: false
  })
);

app.use(requestIdMiddleware);
app.use(globalLimiter);

// Do not install express.json() globally before the proxy.
// The proxy forwards the original request stream/body directly.
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "api-gateway",
    status: "ok"
  });
});

app.use("/api/v1", blockInternalRoutes, gatewayRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
