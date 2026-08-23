const express = require("express");
const asyncHandler = require("../utils/async-handler");
const controller = require("../controllers/judge.controller");
const { requireInternalService } = require("../middleware/internal.middleware");
const router = express.Router();
router.post(
  "/internal/judge",
  requireInternalService,
  asyncHandler(controller.judge),
);
router.post(
  "/internal/run",
  requireInternalService,
  asyncHandler(controller.run),
);
module.exports = router;
