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
          code: err?.code,
          message: err?.message,
          requestId: req.id,
        });

        if (res.headersSent) return;

        res.status(502).json({
          success: false,
          message: `${serviceName} is unavailable`,
          code: "UPSTREAM_UNAVAILABLE",
          requestId: req.id,
        });
      },
    },
  });
}

module.exports = {
  createServiceProxy,
};
