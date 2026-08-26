const AppError = require("../utils/app-error");

function blockInternalRoutes(req, _res, next) {
  const segments = req.path
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment).toLowerCase();
      } catch {
        return segment.toLowerCase();
      }
    });

  if (segments.includes("internal")) {
    return next(
      new AppError(
        404,
        "Route not found",
        "ROUTE_NOT_FOUND"
      )
    );
  }

  return next();
}

module.exports = blockInternalRoutes;
