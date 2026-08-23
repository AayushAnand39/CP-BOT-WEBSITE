const { z } = require("zod");
const service = require("../services/bot.service");
const liveScheduler = require("../services/live-scheduler.service");
const AppError = require("../utils/app-error");

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(40);

const createSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(2).max(80),
  rating: z.number().int().min(0).max(5000),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  aggression: z.number().min(0).max(1).default(0.5),
  consistency: z.number().min(0).max(1).default(0.7),
  speed: z.number().min(0).max(1).default(0.5),
  tagStrengths: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  tagWeaknesses: z.array(z.string().trim().min(1).max(50)).max(20).default([])
});

const updateSchema = createSchema.partial().omit({ slug: true });

const planSchema = z.object({
  contestId: z.string().uuid(),
  seed: z.union([z.string().min(1).max(100), z.number().int().nonnegative()]).optional()
});

function parse(schema, data) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid request data",
      "VALIDATION_ERROR",
      parsed.error.flatten().fieldErrors
    );
  }
  return parsed.data;
}

async function list(_req, res) {
  res.json({ success: true, data: { bots: await service.listBots() } });
}

async function get(req, res) {
  const bot = await service.getBot(req.params.id);
  res.json({ success: true, data: { bot: service.publicBot(bot) } });
}

async function create(req, res) {
  const data = parse(createSchema, req.body);
  const bot = await service.createBot(data);
  res.status(201).json({ success: true, data: { bot } });
}

async function update(req, res) {
  const data = parse(updateSchema, req.body);
  const bot = await service.updateBot(req.params.id, data);
  res.json({ success: true, data: { bot } });
}

async function plan(req, res) {
  const data = parse(planSchema, req.body);
  const plan = await service.buildSimulationPlan({
    botId: req.params.id,
    contestId: data.contestId,
    seed: data.seed
  });
  res.status(201).json({ success: true, data: { simulation: plan } });
}

async function getRun(req, res) {
  const run = await service.getSimulationRun(req.params.runId);
  res.json({ success: true, data: { run } });
}


async function startLive(req, res) {
  const result =
    await liveScheduler.scheduleLiveSimulationRun(
      req.params.runId
    );

  res.status(201).json({
    success: true,
    data: result
  });
}

async function finishLive(req, res) {
  const result = await liveScheduler.finishLiveSimulationRun(req.params.runId);
  res.status(201).json({ success: true, data: result });
}

async function execute(req, res) {
  const result = await service.executeSimulationRun(req.params.runId);
  res.status(201).json({ success: true, data: result });
}

module.exports = { list, get, create, update, plan, getRun, startLive, finishLive, execute };
