const express = require("express");

const asyncHandler = require("../utils/async-handler");
const controller = require("../controllers/auth.controller");

const {
  requireAuth
} = require("../middleware/auth.middleware");

const router = express.Router();

router.post(
  "/register",
  asyncHandler(controller.register)
);

router.post(
  "/login",
  asyncHandler(controller.login)
);

router.post(
  "/verify",
  asyncHandler(controller.verify)
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(controller.me)
);

module.exports = router;