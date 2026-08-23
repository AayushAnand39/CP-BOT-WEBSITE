const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../utils/async-handler");
const { requireInternalService } = require("../middleware/internal.middleware");
const llm = require("../services/llm.service");
const AppError = require("../utils/app-error");

const router = express.Router();

const botAttemptSchema = z.object({
  title: z.string().max(300).default(""),
  statement: z.string().max(200000).default(""),
  constraints: z.string().max(50000).default(""),
  inputFormat: z.string().max(50000).default(""),
  outputFormat: z.string().max(50000).default(""),
  referenceSolution: z.string().min(1).max(300000),
  botRating: z.number().int().min(600).max(4000),
  problemRating: z.number().int().min(0).max(5000),
  attemptNumber: z.number().int().min(1).max(5).default(1),
  bugClass: z.enum(["boundary", "overflow", "edge_case", "complexity", "logic"]).default("logic")
});

router.post(
  "/bot-attempt",
  requireInternalService,
  asyncHandler(async (req, res) => {
    const parsed = botAttemptSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid bot-attempt request", "VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }
    const result = await llm.generateBotAttempt(parsed.data);
    res.json({ success: true, data: result });
  })
);

module.exports = router;
