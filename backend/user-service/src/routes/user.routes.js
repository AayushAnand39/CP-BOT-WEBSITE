const express = require("express");
const asyncHandler = require("../utils/async-handler");
const controller = require("../controllers/user.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const requireInternal = require("../middleware/internal.middleware");

const router = express.Router();

router.get("/public/:username", asyncHandler(controller.publicProfile));

router.get("/me", requireAuth, asyncHandler(controller.me));
router.patch("/me", requireAuth, asyncHandler(controller.updateMe));
router.get("/me/stats", requireAuth, asyncHandler(controller.stats));
router.patch(
  "/me/preferences",
  requireAuth,
  asyncHandler(controller.updatePreferences),
);

router.post(
  "/internal/users",
  requireInternal,
  asyncHandler(controller.createInternal),
);
router.patch(
  "/internal/users/:userId/rating",
  requireInternal,
  asyncHandler(controller.ratingInternal),
);
router.patch(
  "/internal/users/:userId/stats",
  requireInternal,
  asyncHandler(controller.statsInternal),
);

// New service-safe atomic endpoints.
router.patch(
  "/internal/users/:userId/stats/increment",
  requireInternal,
  asyncHandler(controller.statsIncrementInternal),
);
router.post(
  "/internal/users/:userId/challenge-results",
  requireInternal,
  asyncHandler(controller.challengeResultInternal),
);

module.exports = router;
