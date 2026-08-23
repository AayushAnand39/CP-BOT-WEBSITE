const { env } = require("../config/env");
const AppError = require("../utils/app-error");
function notFoundHandler(req, _res, next) {
  next(
    new AppError(
      404,
      `Route not found: ${req.method} ${req.originalUrl}`,
      "ROUTE_NOT_FOUND",
    ),
  );
}
function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  const code = err.code || "INTERNAL_SERVER_ERROR";
  if (status >= 500)
    console.error({
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      error: err.stack || err.message,
    });
  const out = {
    success: false,
    message:
      status >= 500 && env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    code,
  };
  if (err.details !== undefined) out.details = err.details;
  res.status(status).json(out);
}
module.exports = { notFoundHandler, errorHandler };
