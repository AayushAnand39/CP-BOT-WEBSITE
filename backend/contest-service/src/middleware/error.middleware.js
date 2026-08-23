const AppError = require("../utils/app-error");
function notFoundHandler(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
}
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) console.error({ requestId: req.id, error: err.stack || err.message });
  const body = { success: false, message: statusCode >= 500 ? "Internal server error" : err.message, code: err.code || "INTERNAL_SERVER_ERROR" };
  if (err.details !== undefined) body.details = err.details;
  res.status(statusCode).json(body);
}
module.exports = { notFoundHandler, errorHandler };
