const { env } = require("../config/env");
const AppError = require("../utils/app-error");

function notFoundHandler(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: statusCode >= 500 && env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
    code: err.code || "INTERNAL_SERVER_ERROR"
  };

  if (err.details !== undefined) response.details = err.details;
  if (statusCode >= 500) console.error(err);

  res.status(statusCode).json(response);
}

module.exports = { notFoundHandler, errorHandler };
