const { createRandom } = require("../utils/deterministic-random");
const { clamp, sigmoid } = require("../utils/math");

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.map((tag) => String(tag).toLowerCase()) : [];
}

function tagModifier(bot, problemTags) {
  const tags = normalizeTags(problemTags);
  const strengths = normalizeTags(bot.tagStrengths);
  const weaknesses = normalizeTags(bot.tagWeaknesses);
  let modifier = 0;
  for (const tag of tags) {
    if (strengths.includes(tag)) modifier += 0.045;
    if (weaknesses.includes(tag)) modifier -= 0.07;
  }
  return clamp(modifier, -0.16, 0.14);
}

function computeProbabilities(bot, problem) {
  const gap = bot.rating - problem.rating;

  // Deliberately steep skill curve: rating must materially change behavior.
  // Around equal rating the bot is competitive, 300-400 below is a long shot,
  // and 300-400 above is a strong favourite.
  const baseSolve = 0.025 + 0.95 * sigmoid((gap + 35) / 125);
  const solveProbability = clamp(
    baseSolve + tagModifier(bot, problem.tags) + (bot.consistency - 0.5) * 0.08,
    0.015,
    0.992
  );

  const pressure = clamp((problem.rating - bot.rating) / 500, -0.8, 1.2);
  const wrongAnswerProbability = clamp(
    0.08 + pressure * 0.17 + (0.65 - bot.consistency) * 0.22 + bot.aggression * 0.035,
    0.025,
    0.55
  );

  return { solveProbability, wrongAnswerProbability };
}

function estimateWorkSeconds(bot, problem, random, durationSeconds) {
  const gap = problem.rating - bot.rating;
  const contestScale = clamp(durationSeconds / 300, 0.65, 8);
  const base = 24 + Math.max(0, gap + 350) * 0.22;
  const masteryDiscount = Math.max(0, -gap) * 0.035;
  const speedFactor = 1.22 - bot.speed * 0.48;
  const consistencyFactor = 1.10 - bot.consistency * 0.18;
  const jitter = 0.82 + random() * 0.38;
  const seconds = (base - masteryDiscount) * speedFactor * consistencyFactor * jitter * Math.sqrt(contestScale);
  return Math.max(12, Math.round(seconds));
}

function chooseBugClass(random, bot, problem) {
  const gap = problem.rating - bot.rating;
  const roll = random();
  if (gap >= 250 && roll < 0.32) return "complexity";
  if (bot.rating <= 1400 && roll < 0.45) return "overflow";
  if (roll < 0.68) return "boundary";
  if (roll < 0.86) return "edge_case";
  return "logic";
}

// Builds one sequential timeline for the entire contest. Problems are not solved
// independently in parallel, so two hard ACs cannot appear a few seconds apart.
function simulateContest({ bot, problems, contestId, contestSeed, durationSeconds }) {
  const random = createRandom([
    "cpbot-v4-sequential-skill",
    bot.id,
    bot.slug,
    contestId,
    contestSeed,
    durationSeconds
  ]);

  const ordered = problems.slice().sort((a, b) =>
    (a.rating - b.rating) || (a.ordinal - b.ordinal) || String(a.id).localeCompare(String(b.id))
  );

  let clock = Math.max(8, Math.round(durationSeconds * 0.025));
  const hardStop = Math.max(20, durationSeconds - 8);
  const plans = [];
  const events = [];

  for (const problem of ordered) {
    const { solveProbability, wrongAnswerProbability } = computeProbabilities(bot, problem);
    const gap = problem.rating - bot.rating;
    const work = estimateWorkSeconds(bot, problem, random, durationSeconds);
    const remaining = hardStop - clock;

    if (remaining < 12) {
      plans.push({
        problemId: problem.id,
        problemRating: problem.rating,
        solveProbability,
        wrongAnswerProbability,
        solved: false,
        reason: "NO_TIME",
        expectedSolveTimeSeconds: null,
        events: []
      });
      continue;
    }

    // Reading/context-switch cost grows a little on harder problems.
    clock += Math.min(remaining, Math.max(6, Math.round(8 + Math.max(0, gap) * 0.018 + random() * 8)));

    const canSolve = random() < solveProbability;
    const localEvents = [];
    let attemptNo = 0;

    // Failed attempts consume real debugging time. Lower-rated bots and problems
    // above the bot's rating are more likely to need one.
    const wantsFailedAttempt = random() < wrongAnswerProbability;
    const maxFailed = bot.rating < 1500 ? 1 : (bot.rating < 1900 ? 2 : 1);
    const failedAttempts = wantsFailedAttempt ? Math.min(maxFailed, 1 + (random() < wrongAnswerProbability * 0.35 ? 1 : 0)) : 0;

    if (canSolve) {
      const totalWork = Math.max(12, work);
      for (let i = 0; i < failedAttempts; i++) {
        const slice = Math.max(10, Math.round(totalWork * (0.32 + 0.14 * i + random() * 0.10)));
        clock += slice;
        if (clock >= hardStop) break;
        attemptNo += 1;
        localEvents.push({
          sequence: attemptNo,
          atSeconds: clock,
          attemptKind: "BUGGY",
          bugClass: chooseBugClass(random, bot, problem),
          plannedOutcome: "FAIL"
        });
        clock += Math.max(8, Math.round(10 + (1 - bot.speed) * 18 + random() * 12));
      }

      const finalThink = Math.max(12, Math.round(totalWork * (failedAttempts ? 0.58 : 1.0)));
      clock += finalThink;
      if (clock < hardStop) {
        attemptNo += 1;
        localEvents.push({
          sequence: attemptNo,
          atSeconds: clock,
          attemptKind: "REFERENCE",
          bugClass: null,
          plannedOutcome: "SOLVE"
        });
      }
    } else {
      // An unsolved problem still consumes thinking time; tougher problems can eat
      // a large fraction of a short contest and prevent instant jumps to the next.
      const commitment = clamp(
        0.42 + bot.aggression * 0.20 + Math.max(0, gap) / 1400,
        0.38,
        0.82
      );
      clock += Math.min(remaining, Math.max(18, Math.round(work * commitment)));
      if (clock < hardStop && random() < clamp(0.48 + bot.aggression * 0.25, 0.45, 0.82)) {
        attemptNo += 1;
        localEvents.push({
          sequence: attemptNo,
          atSeconds: clock,
          attemptKind: "BUGGY",
          bugClass: chooseBugClass(random, bot, problem),
          plannedOutcome: "FAIL"
        });
      }
    }

    for (const event of localEvents) {
      events.push({ ...event, problemId: problem.id, problemRating: problem.rating });
    }

    plans.push({
      problemId: problem.id,
      problemRating: problem.rating,
      solveProbability,
      wrongAnswerProbability,
      solved: localEvents.some((e) => e.attemptKind === "REFERENCE"),
      expectedSolveTimeSeconds: localEvents.find((e) => e.attemptKind === "REFERENCE")?.atSeconds ?? null,
      events: localEvents
    });

    // A human-like pause before starting the next statement.
    clock += Math.round(5 + random() * 12);
  }

  events.sort((a, b) => a.atSeconds - b.atSeconds || a.problemRating - b.problemRating);
  return { problems: plans, events };
}

module.exports = {
  computeProbabilities,
  estimateWorkSeconds,
  simulateContest,
  tagModifier
};
