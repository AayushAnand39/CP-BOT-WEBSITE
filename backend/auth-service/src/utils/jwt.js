const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: "access"
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: "cp-bot-auth-service",
      audience: "cp-bot-platform"
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: "cp-bot-auth-service",
    audience: "cp-bot-platform"
  });
}

module.exports = {
  signAccessToken,
  verifyAccessToken
};