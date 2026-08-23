const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: "cp-bot-auth-service",
    audience: "cp-bot-platform"
  });
}
module.exports = { verifyAccessToken };
