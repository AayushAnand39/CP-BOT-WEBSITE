const { z } = require("zod");
const service = require("../services/contest.service");
const challengeService = require("../services/challenge.service");
const completionService = require("../services/completion.service");
const AppError = require("../utils/app-error");
const createSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().max(1000).optional(),
  seed: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  difficultyMin: z.number().int().min(0),
  difficultyMax: z.number().int().min(0),
  problemCount: z.number().int().min(1).max(20),
  durationSeconds: z.number().int().min(60).max(86400),
  startsAt: z.string().datetime().optional()
});
const submitSchema = z.object({
  problemId: z.string().uuid(),
  language: z.literal("cpp"),
  sourceCode: z.string().min(1).max(200000),
});
const runSchema = z.object({
  problemId: z.string().uuid(),
  language: z.literal("cpp"),
  sourceCode: z.string().min(1).max(200000),
  input: z.string().max(2_000_000).default(""),
  expectedOutput: z.string().max(2_000_000).optional()
});
const botSubmissionSchema = z.object({
  botId: z.string().min(1).max(100),
  problemId: z.string().uuid(),
  sourceCode: z.string().min(1).max(300000),
  submittedAt: z.string().datetime().optional()
});

const challengeSchema = z.object({
  botId: z.string().min(1).max(100),
  problemCount: z.number().int().min(1).max(20).default(4),
  durationSeconds: z.number().int().min(300).max(86400).default(7200),
  difficultyMin: z.number().int().min(0).optional(),
  difficultyMax: z.number().int().min(0).optional(),
  seed: z.union([
    z.string().regex(/^\d+$/),
    z.number().int().nonnegative()
  ]).optional()
});
function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(400, "Invalid request data", "VALIDATION_ERROR", result.error.flatten().fieldErrors);
  return result.data;
}
async function create(req, res) { const data = parse(createSchema, req.body); res.status(201).json({ success: true, data: { contest: await service.createContest(data) } }); }
async function list(req, res) { const status = req.query.status; res.json({ success: true, data: { contests: await service.listContests({ status }) } }); }
async function get(req, res) { res.json({ success: true, data: { contest: await service.getContest(req.params.id) } }); }
async function getProblem(req, res) { res.json({ success: true, data: { problem: await service.getContestProblemDetails(req.params.id, req.params.problemId) } }); }
async function join(req, res) { res.status(201).json({ success: true, data: { participant: await service.joinContest(req.params.id, req.auth.userId) } }); }
async function standings(req, res) { res.json({ success: true, data: { standings: await service.getStandings(req.params.id) } }); }
async function activity(req, res) { res.json({ success: true, data: { activity: await service.getActivity(req.params.id, req.auth.userId) } }); }
async function runSamples(req, res) { const data = parse(submitSchema, req.body); res.json({ success: true, data: { result: await service.runSamples({ contestId: req.params.id, userId: req.auth.userId, ...data }) } }); }
async function runCode(req, res) { const data = parse(runSchema, req.body); res.json({ success: true, data: { result: await service.runCode({ contestId: req.params.id, userId: req.auth.userId, ...data }) } }); }
async function getSubmission(req, res) { res.json({ success: true, data: { submission: await service.getSubmission(req.params.id, req.auth.userId, req.params.submissionId) } }); }
async function submit(req, res) { const data = parse(submitSchema, req.body); res.status(201).json({ success: true, data: { submission: await service.submit({ contestId: req.params.id, userId: req.auth.userId, ...data }) } }); }
async function start(req, res) { res.json({ success: true, data: { contest: await service.startContest(req.params.id) } }); }
async function end(req, res) {
  const result = await completionService.completeContest(
    req.params.id,
    { forceEnd: true }
  );

  res.json({
    success: true,
    data: result
  });
}
async function cancel(req, res) { res.json({ success: true, data: { contest: await service.cancelContest(req.params.id) } }); }
async function botSubmission(req, res) { const data = parse(botSubmissionSchema, req.body); res.status(201).json({ success: true, data: { submission: await service.recordBotSubmission({ contestId: req.params.id, ...data }) } }); }

async function createChallenge(req, res) {
  const data = parse(challengeSchema, req.body);

  const result = await challengeService.createChallenge({
    userId: req.auth.userId,
    ...data
  });

  res.status(201).json({
    success: true,
    data: result
  });
}

async function getChallenge(req, res) {
  const challenge = await challengeService.getChallenge({
    challengeId: req.params.challengeId,
    userId: req.auth.userId
  });

  res.json({
    success: true,
    data: { challenge }
  });
}
async function listChallenges(req, res) {
  res.json({ success: true, data: { challenges: await challengeService.listChallengesForUser(req.auth.userId) } });
}

async function finish(req, res) {
  const result = await challengeService.finishChallenge({ contestId: req.params.id, userId: req.auth.userId });
  res.json({ success: true, data: result });
}

module.exports = { create, list, get, getProblem, join, standings, activity, getSubmission, runSamples, runCode, submit, start, end, cancel, botSubmission, createChallenge, getChallenge, listChallenges, finish };
