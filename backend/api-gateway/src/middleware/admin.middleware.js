const AppError = require("../utils/app-error");
const { env } = require("../config/env");

function requireAdmin(req, _res, next) {
  if (!req.auth?.email) {
    return next(
      new AppError(401, "Authentication required", "AUTH_REQUIRED")
    );
  }

  const allowed = env.ADMIN_EMAILS
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.includes(req.auth.email.toLowerCase())) {
    return next(
      new AppError(403, "Administrator access required", "ADMIN_REQUIRED")
    );
  }

  next();
}

module.exports = { requireAdmin };
