const AppError = require("../utils/app-error");
const { verifyAccessToken } = require("../utils/jwt");

function extractBearerToken(header) {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function requireAuth(req, _res, next) {
  const token = extractBearerToken(
    req.headers.authorization
  );

  if (!token) {
    return next(
      new AppError(
        401,
        "Authentication required",
        "AUTH_REQUIRED"
      )
    );
  }

  try {
    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.sub,
      email: payload.email,
      tokenType: payload.type
    };

    return next();
  } catch {
    return next(
      new AppError(
        401,
        "Invalid or expired token",
        "INVALID_TOKEN"
      )
    );
  }
}

module.exports = {
  requireAuth,
  extractBearerToken
};