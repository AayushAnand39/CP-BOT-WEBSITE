const { verifyAccessToken } = require("../utils/jwt");
const { env } = require("../config/env");
const AppError = require("../utils/app-error");
function extractBearerToken(header) {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}
function requireAuth(req, _res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token)
    return next(new AppError(401, "Authentication required", "AUTH_REQUIRED"));
  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== "access" || !payload.sub) throw new Error();
    req.auth = { userId: payload.sub, email: payload.email };
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token", "INVALID_TOKEN"));
  }
}
function requireInternalService(req, _res, next) {
  const token = req.headers["x-internal-service-token"];
  if (!token || token !== env.INTERNAL_SERVICE_TOKEN)
    return next(
      new AppError(
        401,
        "Invalid internal service credentials",
        "INVALID_SERVICE_TOKEN",
      ),
    );
  next();
}
module.exports = { requireAuth, requireInternalService, extractBearerToken };
