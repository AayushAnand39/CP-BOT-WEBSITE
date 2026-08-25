const { createProxyMiddleware } = require("http-proxy-middleware");
const { env } = require("../config/env");

function createServiceProxy({ target, serviceName }) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: env.REQUEST_TIMEOUT_MS,
    timeout: env.REQUEST_TIMEOUT_MS,

    // Forward the exact public API path the frontend requested. Each
    // downstream service already exposes the same /api/v1/<service> prefix.
    pathRewrite(_path, req) {
      return req.originalUrl;
    },

    on: {
      proxyReq(proxyReq, req) {
        if (req.id) {
          proxyReq.setHeader("x-request-id", req.id);
        }

        // Never leak the gateway's own internals/service token because this
        // process does not possess or need the internal service token.
        proxyReq.removeHeader("x-internal-service-token");
      },

      error(err, req, res) {
        console.error("[GATEWAY UPSTREAM ERROR]", {
          service: serviceName,
          target,
          method: req.method,
          path: req.originalUrl,
          origin: req.headers.origin,
          code: err?.code,
          message: err?.message,
          requestId: req.id,
        });

        if (res.headersSent) {
          try {
            res.end();
          } catch {}
          return;
        }

        const payload = JSON.stringify({
          success: false,
          message: `${serviceName} is unavailable`,
          code: "UPSTREAM_UNAVAILABLE",
          requestId: req.id,
        });

        const allowedOrigins = env.CORS_ORIGINS.split(",")
          .map((value) => value.trim())
          .filter(Boolean);

        const origin = req.headers.origin;

        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Length", Buffer.byteLength(payload));

        console.log("[PROXY CORS DEBUG]", {
          origin,
          allowedOrigins,
        });

        if (origin && allowedOrigins.includes(origin)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Vary", "Origin");
        }

        res.end(payload);
      },
    },
  });
}

module.exports = {
  createServiceProxy,
};
