const { createProxyMiddleware } = require("http-proxy-middleware");
const { env } = require("../config/env");

const allowedOrigins = env.CORS_ORIGINS.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function applyCorsHeaders(headers, req) {
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) return;

  headers["access-control-allow-origin"] = origin;
  const vary = headers.vary;
  if (!vary) headers.vary = "Origin";
  else if (
    !String(vary)
      .toLowerCase()
      .split(",")
      .map((v) => v.trim())
      .includes("origin")
  ) {
    headers.vary = `${vary}, Origin`;
  }
}

function createServiceProxy({ target, serviceName }) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: env.REQUEST_TIMEOUT_MS,
    timeout: env.REQUEST_TIMEOUT_MS,

    pathRewrite(_path, req) {
      return req.originalUrl;
    },

    on: {
      proxyReq(proxyReq, req) {
        if (req.id) {
          proxyReq.setHeader("x-request-id", req.id);
        }

        proxyReq.removeHeader("origin");

        proxyReq.removeHeader("access-control-request-method");

        proxyReq.removeHeader("access-control-request-headers");

        proxyReq.removeHeader("x-internal-service-token");

        // Do not propagate the browser -> Cloudflare ->
        // Render proxy chain into another public Render service.
        proxyReq.removeHeader("x-forwarded-for");
        proxyReq.removeHeader("x-forwarded-host");
        proxyReq.removeHeader("x-forwarded-proto");
        proxyReq.removeHeader("forwarded");
      },

      proxyRes(proxyRes, req) {
        applyCorsHeaders(proxyRes.headers, req);

        // Diagnostic headers visible in browser DevTools.
        proxyRes.headers["x-cpbot-upstream-service"] = serviceName;

        proxyRes.headers["x-cpbot-upstream-status"] = String(
          proxyRes.statusCode,
        );

        if (proxyRes.statusCode >= 400) {
          console.warn("[GATEWAY UPSTREAM RESPONSE]", {
            service: serviceName,
            target,
            method: req.method,
            path: req.originalUrl,
            upstreamStatus: proxyRes.statusCode,
            requestId: req.id,
            cfRay: req.header("cf-ray"),
          });
        }
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

        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Length", Buffer.byteLength(payload));

        const responseHeaders = {};
        applyCorsHeaders(responseHeaders, req);
        for (const [name, value] of Object.entries(responseHeaders)) {
          res.setHeader(name, value);
        }

        res.end(payload);
      },
    },
  });
}

module.exports = { createServiceProxy };
