const express = require("express");
const asyncHandler = require("../utils/async-handler");
const controller = require("../controllers/testcase.controller");
const { requireInternalService } = require("../middleware/internal.middleware");

const router = express.Router();

router.post("/internal/generate", requireInternalService, asyncHandler(controller.generate));
router.get(
  "/internal/:jobId/archive",
  requireInternalService,
  asyncHandler(controller.downloadArchive)
);

router.get("/internal/:jobId/metadata", requireInternalService, asyncHandler(controller.getMetadata));
router.post("/internal/:jobId/rebuild-archive", requireInternalService, asyncHandler(controller.rebuildArchive));

router.get("/internal/:jobId/tests", requireInternalService, asyncHandler(controller.getTests));

router.delete("/internal/:jobId", requireInternalService, asyncHandler(controller.cleanup));

module.exports = router;