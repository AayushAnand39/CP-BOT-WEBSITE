const { prisma } = require("./db.service");
const contestClient = require("./contest-client.service");
const problemClient = require("./problem-client.service");
const aiClient = require("./ai-client.service");
const simulation = require("./simulation.service");
const AppError = require("../utils/app-error");

function publicBot(bot) {
  return {
    id: bot.id,
    slug: bot.slug,
    name: bot.name,
    rating: bot.rating,
    description: bot.description,
    aggression: bot.aggression,
    consistency: bot.consistency,
    speed: bot.speed,
    tagStrengths: bot.tagStrengths,
    tagWeaknesses: bot.tagWeaknesses
  };
}

async function listBots() {
  const bots = await prisma.bot.findMany({
    where: { enabled: true },
    orderBy: [{ rating: "asc" }, { name: "asc" }]
  });
  return bots.map(publicBot);
}

async function getBot(idOrSlug, includeDisabled = false) {
  const bot = await prisma.bot.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      ...(includeDisabled ? {} : { enabled: true })
    }
  });
  if (!bot) throw new AppError(404, "Bot not found", "BOT_NOT_FOUND");
  return bot;
}

async function createBot(input) {
  const existing = await prisma.bot.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError(409, "Bot slug already exists", "BOT_SLUG_EXISTS");
  return prisma.bot.create({ data: input });
}

async function updateBot(id, input) {
  await getBot(id, true);
  return prisma.bot.update({ where: { id }, data: input });
}

async function loadContestProblems(contest) {
  const refs = Array.isArray(contest.problems) ? contest.problems : [];
  if (!refs.length) throw new AppError(409, "Contest has no problems", "CONTEST_HAS_NO_PROBLEMS");

  return Promise.all(refs.slice().sort((a, b) => a.ordinal - b.ordinal).map(async (ref) => {
    const problem = await problemClient.getProblemInternal(ref.problemId);
    return {
      id: ref.problemId,
      rating: Number.isInteger(problem.rating) ? problem.rating : ref.problemRating,
      tags: Array.isArray(problem.tags) ? problem.tags : [],
      ordinal: ref.ordinal,
      full: problem
    };
  }));
}

function fallbackBuggySource(reference, bugClass, botRating) {
  let source = String(reference || "");
  if (!source.trim()) return "#include <bits/stdc++.h>\nusing namespace std;\nint main(){return 0;}";

  const replacements = bugClass === "overflow"
    ? [[/\blong long\b/, "int"], [/\bint64_t\b/, "int"]]
    : bugClass === "boundary"
      ? [[/<=/, "<"], [/>=/, ">"], [/\b<\b/, "<="]]
      : bugClass === "edge_case"
        ? [[/==\s*0/, "== -1"], [/==\s*1/, "== 0"], [/\+\s*1\b/, "+ 0"]]
        : bugClass === "complexity"
          ? [[/unordered_map/, "map"], [/unordered_set/, "set"]]
          : [[/==/, "!="], [/\+\s*1\b/, "+ 0"], [/-\s*1\b/, "- 0"]];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(source)) return source.replace(pattern, replacement);
  }

  // Last-resort subtle wrong-answer mutation. No giveaway comments or fake crashes.
  if (botRating < 1500 && /return\s+0\s*;/.test(source)) {
    return source.replace(/return\s+0\s*;/, "if(false) cout << 0 << '\\n';\n    return 0;");
  }
  return source.replace(/\bans\s*\+\+/g, "ans += 2");
}

async function sourceForEvent(bot, problem, event) {
  const reference = String(problem.full?.solutionCode || "");
  if (event.attemptKind === "REFERENCE") {
    return { sourceCode: reference, generation: "REFERENCE", mistakeSummary: null };
  }

  try {
    const generated = await aiClient.generateBotAttempt({
      title: String(problem.full?.title || ""),
      statement: String(problem.full?.statement || ""),
      constraints: String(problem.full?.constraints || ""),
      inputFormat: String(problem.full?.inputFormat || ""),
      outputFormat: String(problem.full?.outputFormat || ""),
      referenceSolution: reference,
      botRating: bot.rating,
      problemRating: problem.rating,
      attemptNumber: event.sequence,
      bugClass: event.bugClass || "logic"
    });
    return {
      sourceCode: generated.sourceCode,
      generation: "AI",
      mistakeSummary: generated.mistakeSummary || event.bugClass || null
    };
  } catch (error) {
    console.warn(`AI bot-attempt generation failed for ${problem.id}; using deterministic fallback: ${error.message}`);
    return {
      sourceCode: fallbackBuggySource(reference, event.bugClass || "logic", bot.rating),
      generation: "FALLBACK",
      mistakeSummary: event.bugClass || "logic"
    };
  }
}

async function buildSimulationPlan({ botId, contestId, seed }) {
  const bot = await getBot(botId);
  const contest = await contestClient.getContest(contestId);
  if (!["SCHEDULED", "RUNNING"].includes(contest.status)) {
    throw new AppError(409, "Bot simulation can only be planned for a scheduled or running contest", "INVALID_CONTEST_STATE");
  }

  const problems = await loadContestProblems(contest);
  const effectiveSeed = String(seed ?? contest.seed);
  const timeline = simulation.simulateContest({
    bot,
    problems,
    contestId,
    contestSeed: effectiveSeed,
    durationSeconds: contest.durationSeconds
  });

  const byId = new Map(problems.map((p) => [p.id, p]));
  const enrichedEvents = [];
  for (const event of timeline.events) {
    const problem = byId.get(event.problemId);
    const source = await sourceForEvent(bot, problem, event);
    enrichedEvents.push({ ...event, ...source });
  }

  const enrichedProblems = timeline.problems.map((plan) => ({
    ...plan,
    events: enrichedEvents.filter((event) => event.problemId === plan.problemId)
  }));

  const plan = {
    version: "cpbot-intelligence-v4",
    bot: publicBot(bot),
    contest: {
      id: contest.id,
      seed: String(contest.seed),
      status: contest.status,
      durationSeconds: contest.durationSeconds
    },
    effectiveSeed,
    problems: enrichedProblems,
    events: enrichedEvents,
    summary: {
      totalProblems: enrichedProblems.length,
      predictedSolved: enrichedProblems.filter((p) => p.solved).length,
      plannedBuggyAttempts: enrichedEvents.filter((e) => e.attemptKind === "BUGGY").length
    }
  };

  const run = await prisma.botSimulationRun.create({
    data: { botId: bot.id, contestId, seed: effectiveSeed, mode: "PLAN", planJson: plan }
  });
  return { runId: run.id, ...plan };
}

async function getSimulationRun(runId) {
  const run = await prisma.botSimulationRun.findUnique({ where: { id: runId }, include: { bot: true } });
  if (!run) throw new AppError(404, "Simulation run not found", "SIMULATION_RUN_NOT_FOUND");
  return run;
}

async function executeSimulationRun(runId) {
  const run = await getSimulationRun(runId);
  if (run.executed) throw new AppError(409, "Simulation run has already been executed", "SIMULATION_ALREADY_EXECUTED");
  const contest = await contestClient.getContest(run.contestId);
  if (contest.status !== "RUNNING") throw new AppError(409, "Contest must be RUNNING before bot events can be recorded", "CONTEST_NOT_RUNNING");
  if (!contest.startsAt) throw new AppError(409, "Contest does not have a start time", "CONTEST_START_TIME_MISSING");

  const results = [];
  const solved = new Set();
  for (const event of run.planJson.events || []) {
    if (solved.has(event.problemId)) continue;
    const submittedAt = new Date(new Date(contest.startsAt).getTime() + event.atSeconds * 1000);
    const result = await contestClient.recordBotSubmission(run.contestId, {
      botId: run.botId,
      problemId: event.problemId,
      sourceCode: event.sourceCode,
      submittedAt: submittedAt.toISOString()
    });
    if (result.verdict === "AC") solved.add(event.problemId);
    results.push({ plannedAtSeconds: event.atSeconds, submittedAt: submittedAt.toISOString(), submission: result });
  }

  await prisma.botSimulationRun.update({ where: { id: runId }, data: { executed: true, executedAt: new Date(), mode: "EXECUTED" } });
  return { runId, contestId: run.contestId, botId: run.botId, executedEvents: results.length, results, timingWarning: null };
}

module.exports = {
  listBots,
  getBot,
  createBot,
  updateBot,
  buildSimulationPlan,
  getSimulationRun,
  executeSimulationRun,
  publicBot
};
