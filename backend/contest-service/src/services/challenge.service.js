const crypto = require("crypto");
const { prisma } = require("./db.service");
const contestService = require("./contest.service");
const botClient = require("./bot-client.service");
const AppError = require("../utils/app-error");
const { scheduleContestEnd } = require("./contest-end-scheduler.service");

function createSeed() {
  const raw = crypto.randomBytes(8).readBigUInt64BE();
  const signed63Bit = raw & ((1n << 63n) - 1n);
  return (signed63Bit === 0n ? 1n : signed63Bit).toString();
}

function serializeChallenge(challenge) {
  return {
    ...challenge,
    contest: challenge.contest
      ? contestService.serializeContest(challenge.contest)
      : undefined
  };
}

async function markFailed(challengeId, error) {
  await prisma.botChallenge.update({
    where: { id: challengeId },
    data: {
      status: "FAILED",
      failureReason: String(error?.message || "Challenge preparation failed").slice(0, 1000)
    }
  }).catch(() => {});
}

async function createChallenge({
  userId,
  botId,
  problemCount = 4,
  durationSeconds = 7200,
  difficultyMin,
  difficultyMax,
  seed
}) {
  const bot = await botClient.getBot(botId);

  // Bot challenges intentionally span from entry-level problems upward so the
  // rating difference is visible in both contest composition and bot behaviour.
  const resolvedDifficultyMin = difficultyMin ?? 800;
  const resolvedDifficultyMax = difficultyMax ?? Math.max(1000, bot.rating + 200);

  if (resolvedDifficultyMin > resolvedDifficultyMax) {
    throw new AppError(
      400,
      "difficultyMin cannot exceed difficultyMax",
      "INVALID_DIFFICULTY_RANGE"
    );
  }

  const contestSeed = String(seed ?? createSeed());

  // Use SCHEDULED during preparation because Bot Service deliberately
  // refuses to build plans for an unprepared DRAFT contest.
  const scheduledStart = new Date(Date.now() + 60_000);

  const contest = await contestService.createContest({
    name: `Challenge vs ${bot.name}`,
    description: `User-vs-bot challenge against ${bot.name} (${bot.rating})`,
    seed: contestSeed,
    difficultyMin: resolvedDifficultyMin,
    difficultyMax: resolvedDifficultyMax,
    problemCount,
    durationSeconds,
    startsAt: scheduledStart.toISOString()
  });

  const challenge = await prisma.botChallenge.create({
    data: {
      contestId: contest.id,
      userId,
      botId: bot.id,
      botRating: bot.rating,
      status: "PREPARING"
    }
  });

  try {
    await contestService.joinContest(
      contest.id,
      userId,
      "USER"
    );

    await contestService.joinContest(
      contest.id,
      bot.id,
      "BOT"
    );

    const simulation = await botClient.createSimulationPlan({
      botId: bot.id,
      contestId: contest.id,
      seed: contestSeed
    });

    await prisma.botChallenge.update({
      where: { id: challenge.id },
      data: {
        simulationRunId: simulation.runId
      }
    });

    const runningContest =
      await contestService.startContest(contest.id);

    const liveExecution =
      await botClient.startLiveSimulation(simulation.runId);

    const autoEnd =
      await scheduleContestEnd(contest.id);

    const updatedChallenge =
      await prisma.botChallenge.update({
        where: { id: challenge.id },
        data: {
          status: "RUNNING"
        },
        include: {
          contest: {
            include: {
              problems: {
                orderBy: { ordinal: "asc" }
              },
              participants: true
            }
          }
        }
      });

    return {
      challenge: serializeChallenge(updatedChallenge),
      bot,
      simulation: {
        runId: simulation.runId,
        summary: simulation.summary,
        effectiveSeed: simulation.effectiveSeed
      },
      liveExecution,
      autoEnd
    };
  } catch (error) {
    await contestService.cancelContest(contest.id)
      .catch(() => {});

    // cancelContest marks linked challenges CANCELLED, so mark the
    // orchestration failure last to preserve the actual failure state.
    await markFailed(challenge.id, error);

    throw error;
  }
}

async function getChallenge({
  challengeId,
  userId
}) {
  const challenge =
    await prisma.botChallenge.findUnique({
      where: { id: challengeId },
      include: {
        contest: {
          include: {
            problems: {
              orderBy: { ordinal: "asc" }
            },
            participants: true
          }
        }
      }
    });

  if (!challenge) {
    throw new AppError(
      404,
      "Challenge not found",
      "CHALLENGE_NOT_FOUND"
    );
  }

  if (challenge.userId !== userId) {
    throw new AppError(
      403,
      "You do not have access to this challenge",
      "CHALLENGE_FORBIDDEN"
    );
  }

  return serializeChallenge(challenge);
}

async function listChallengesForUser(userId) {
  const challenges = await prisma.botChallenge.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      contest: {
        include: {
          problems: { orderBy: { ordinal: "asc" } },
          participants: true
        }
      }
    }
  });
  return challenges.map(serializeChallenge);
}

async function finishChallenge({ contestId, userId }) {
  const challenge = await prisma.botChallenge.findUnique({
    where: { contestId },
    include: { contest: true }
  });
  if (!challenge) throw new AppError(404, "Challenge not found", "CHALLENGE_NOT_FOUND");
  if (challenge.userId !== userId) throw new AppError(403, "You do not own this challenge", "CHALLENGE_FORBIDDEN");

  if (challenge.status === "ENDED") {
    const completionService = require("./completion.service");
    return completionService.completeContest(contestId, { forceEnd: true });
  }
  if (challenge.status !== "RUNNING") {
    throw new AppError(409, `Cannot finish challenge from ${challenge.status}`, "INVALID_CHALLENGE_STATE");
  }

  if (challenge.simulationRunId) {
    await botClient.finishLiveSimulation(challenge.simulationRunId);
  }

  const completionService = require("./completion.service");
  return completionService.completeContest(contestId, { forceEnd: true });
}

module.exports = {
  createChallenge,
  getChallenge,
  createSeed,
  listChallengesForUser,
  finishChallenge
};
