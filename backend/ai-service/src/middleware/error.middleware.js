const { env } = require("../config/env");
const AppError = require("../utils/app-error");

function notFound(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
}

function errorHandler(err, _req, res, _next) {
  if ((err.statusCode || 500) >= 500) console.error(err);
  const status = err.statusCode || 500;

  res.status(status).json({
    success: false,
    message: status >= 500 && env.NODE_ENV === "production" ? "Internal server error" : err.message,
    code: err.code || "INTERNAL_SERVER_ERROR",
    ...(err.details !== undefined ? { details: err.details } : {})
  });
}

module.exports = { notFound, errorHandler };
