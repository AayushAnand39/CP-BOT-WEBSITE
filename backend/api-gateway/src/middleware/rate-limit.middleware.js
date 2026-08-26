const rateLimitPackage = require("express-rate-limit");
const { env } = require("../config/env");

// express-rate-limit v8 exports both rateLimit and ipKeyGenerator.
const rateLimit = rateLimitPackage.rateLimit || rateLimitPackage;
const { ipKeyGenerator } = rateLimitPackage;

/**
 * Render sits behind Cloudflare + Render load balancers. Using req.socket's
 * address (or an incorrectly resolved req.ip) can therefore put many real
 * users into the same rate-limit bucket.
 *
 * Render supplies CF-Connecting-IP for the original client. Prefer that
 * value in production, then fall back to Express' proxy-aware req.ip.
 */
function getClientIp(req) {
  const cfConnectingIp = req.header("cf-connecting-ip");

  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimitKey(req) {
  const ip = getClientIp(req);

  // Keep express-rate-limit's IPv6 subnet handling when available.
  return typeof ipKeyGenerator === "function" ? ipKeyGenerator(ip) : ip;
}

function blockedHandler(code, message, source) {
  return (req, res, _next, options) => {
    console.warn("[RATE LIMIT BLOCKED]", {
      source,
      method: req.method,
      path: req.originalUrl,
      clientIp: getClientIp(req),
      reqIp: req.ip,
      forwardedFor: req.header("x-forwarded-for"),
      cfConnectingIp: req.header("cf-connecting-ip"),
      cfRay: req.header("cf-ray"),
      userAgent: req.header("user-agent"),
      requestId: req.id,
    });

    return res.status(options.statusCode).json({
      success: false,
      message,
      code,
      requestId: req.id,
    });
  };
}

const globalLimiter = rateLimit({
  windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
  limit: env.GLOBAL_RATE_LIMIT_MAX,
  keyGenerator: rateLimitKey,
  skip(req) {
    return req.method === "OPTIONS";
  },
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: blockedHandler(
    "GATEWAY_RATE_LIMITED",
    "Gateway global rate limit exceeded. Please try again later.",
    "global",
  ),
});

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  keyGenerator: rateLimitKey,
  skip(req) {
    return req.method === "OPTIONS";
  },
  standardHeaders: "draft-8",
  legacyHeaders: false,

  // Only failed authentication attempts remain charged against the bucket.
  skipSuccessfulRequests: true,

  handler: blockedHandler(
    "GATEWAY_AUTH_RATE_LIMITED",
    "Gateway authentication rate limit exceeded. Please try again later.",
    "auth",
  ),
});

module.exports = {
  globalLimiter,
  authLimiter,
  getClientIp,
};
