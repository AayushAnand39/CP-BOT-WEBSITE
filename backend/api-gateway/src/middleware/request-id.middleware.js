const crypto = require("crypto");

function requestIdMiddleware(req, res, next) {
  const requestId = req.header("x-request-id") || crypto.randomUUID();

  req.id = requestId;
  res.setHeader("x-request-id", requestId);

  next();
}

module.exports = requestIdMiddleware;
