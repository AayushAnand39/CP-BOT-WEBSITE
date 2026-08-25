const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");

const globalLimiter = rateLimit({
  windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
  limit: env.GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Gateway global rate limit exceeded. Please try again later.",
    code: "GATEWAY_RATE_LIMITED",
  },
});

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message:
      "Gateway authentication rate limit exceeded. Please try again later.",
    code: "GATEWAY_AUTH_RATE_LIMITED",
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
};
