const { prisma } = require("./db.service");
const completionService = require("./completion.service");

const timers = new Map();

function clearContestTimer(contestId) {
  const timer = timers.get(contestId);
  if (timer) clearTimeout(timer);
  timers.delete(contestId);
}

async function runCompletion(contestId) {
  clearContestTimer(contestId);

  try {
    await completionService.completeContest(contestId);
    console.log(`Contest ${contestId} automatically completed`);
  } catch (error) {
    console.error(
      `Automatic completion failed for contest ${contestId}:`,
      error.message
    );

    // User Service may have been temporarily unavailable.
    // If the contest has already ended but result application failed,
    // retry the idempotent completion shortly.
    const contest = await prisma.contest.findUnique({
      where: { id: contestId }
    }).catch(() => null);

    if (contest?.status === "ENDED") {
      const retry = setTimeout(() => {
        runCompletion(contestId);
      }, 30_000);

      timers.set(contestId, retry);
    }
  }
}

async function scheduleContestEnd(contestId) {
  clearContestTimer(contestId);

  const contest = await prisma.contest.findUnique({
    where: { id: contestId }
  });

  if (!contest || contest.status !== "RUNNING" || !contest.endsAt) {
    return {
      contestId,
      scheduled: false
    };
  }

  const delay = Math.max(
    0,
    contest.endsAt.getTime() - Date.now()
  );

  const timer = setTimeout(() => {
    runCompletion(contestId);
  }, delay);

  timers.set(contestId, timer);

  return {
    contestId,
    scheduled: true,
    endsAt: contest.endsAt,
    delayMs: delay
  };
}

async function recoverContestEndTimers() {
  const contests = await prisma.contest.findMany({
    where: {
      status: "RUNNING",
      endsAt: { not: null }
    },
    select: { id: true }
  });

  return Promise.all(
    contests.map((contest) =>
      scheduleContestEnd(contest.id)
    )
  );
}

function shutdownContestEndScheduler() {
  for (const contestId of [...timers.keys()]) {
    clearContestTimer(contestId);
  }
}

module.exports = {
  scheduleContestEnd,
  recoverContestEndTimers,
  shutdownContestEndScheduler
};
