const { env } = require("../config/env");
const AppError = require("../utils/app-error");

module.exports = function requireInternal(req, _res, next) {
  const token = req.header("x-internal-service-token");

  if (!token || token !== env.INTERNAL_SERVICE_TOKEN) {
    return next(
      new AppError(
        401,
        "Invalid internal service token",
        "INVALID_SERVICE_TOKEN",
      ),
    );
  }

  next();
};
