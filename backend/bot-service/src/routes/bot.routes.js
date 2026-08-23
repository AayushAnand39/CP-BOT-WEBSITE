const express = require("express");
const controller = require("../controllers/bot.controller");
const asyncHandler = require("../utils/async-handler");
const { requireInternal } = require("../middleware/internal.middleware");

const router = express.Router();

router.get("/", asyncHandler(controller.list));
router.get("/:id", asyncHandler(controller.get));

router.post("/internal", requireInternal, asyncHandler(controller.create));
router.patch("/internal/:id", requireInternal, asyncHandler(controller.update));

router.post("/internal/:id/simulations", requireInternal, asyncHandler(controller.plan));
router.get("/internal/simulations/:runId", requireInternal, asyncHandler(controller.getRun));
router.post("/internal/simulations/:runId/start-live", requireInternal, asyncHandler(controller.startLive));
router.post("/internal/simulations/:runId/finish-now", requireInternal, asyncHandler(controller.finishLive));
router.post("/internal/simulations/:runId/execute", requireInternal, asyncHandler(controller.execute));

module.exports = router;
