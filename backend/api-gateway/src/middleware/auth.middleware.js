const AppError = require("../utils/app-error");
const { verifyAccessToken } = require("../utils/jwt");

function extractBearerToken(header) {
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  return token;
}

function requireAuth(req, _res, next) {
  const token = extractBearerToken(req.headers.authorization);

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

    if (payload.type !== "access") {
      throw new Error("Invalid token type");
    }

    req.auth = {
      userId: payload.sub,
      email: payload.email,
      tokenType: payload.type
    };

    // These are convenience identity headers for trusted downstream services.
    // Downstream services must never trust them when called directly from outside
    // the private network; their own JWT/internal auth remains authoritative.
    req.headers["x-auth-user-id"] = payload.sub;
    if (payload.email) {
      req.headers["x-auth-user-email"] = payload.email;
    }

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
