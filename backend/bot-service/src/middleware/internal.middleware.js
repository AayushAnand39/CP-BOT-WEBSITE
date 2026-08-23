const { env } = require("../config/env");
const AppError = require("../utils/app-error");

function requireInternal(req, _res, next) {
  const token = req.header("x-internal-service-token");
  if (!token || token !== env.INTERNAL_SERVICE_TOKEN) {
    return next(new AppError(401, "Internal service authentication required", "INTERNAL_AUTH_REQUIRED"));
  }
  return next();
}

module.exports = { requireInternal };
