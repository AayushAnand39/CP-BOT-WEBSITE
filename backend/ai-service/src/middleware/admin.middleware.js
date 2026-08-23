const { env } = require("../config/env");
const AppError = require("../utils/app-error");

module.exports = function requireAdminGateway(req, _res, next) {
  const token = req.header("x-admin-orchestration-token");

  if (!token || token !== env.ADMIN_ORCHESTRATION_TOKEN) {
    return next(
      new AppError(
        401,
        "Admin gateway authentication required",
        "ADMIN_GATEWAY_AUTH_REQUIRED"
      )
    );
  }

  req.admin = {
    email: req.header("x-admin-user-email") || null,
    userId: req.header("x-admin-user-id") || null
  };

  next();
};
