const { env } = require("../config/env");
const AppError = require("../utils/app-error");

function notFoundHandler(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_SERVER_ERROR";

  if (statusCode >= 500) {
    console.error({
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      error: err.stack || err.message
    });
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 && env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
    code,
    ...(err.details !== undefined ? { details: err.details } : {})
  });
}

module.exports = { notFoundHandler, errorHandler };