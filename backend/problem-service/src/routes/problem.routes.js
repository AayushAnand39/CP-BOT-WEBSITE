const express = require("express");
const asyncHandler = require("../utils/async-handler");
const controller = require("../controllers/problem.controller");
const { requireInternalService } = require("../middleware/internal.middleware");

const router = express.Router();

// Put internal routes first so future public route additions can never shadow them.
router.post("/internal", requireInternalService, asyncHandler(controller.create));
router.get("/internal/:id", requireInternalService, asyncHandler(controller.internalGet));
router.patch("/internal/:id", requireInternalService, asyncHandler(controller.update));
router.delete("/internal/:id", requireInternalService, asyncHandler(controller.remove));

router.get("/", asyncHandler(controller.list));
router.get("/:id", asyncHandler(controller.get));

module.exports = router;
