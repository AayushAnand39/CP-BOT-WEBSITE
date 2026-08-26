const { env } = require("../config/env");
const AppError = require("../utils/app-error");

function requireInternalService(req,_res,next) {
  if (req.headers["x-internal-service-token"] !== env.INTERNAL_SERVICE_TOKEN) {
    return next(new AppError(401,"Invalid internal service credentials","INVALID_SERVICE_TOKEN"));
  }
  next();
}
module.exports = { requireInternalService };
