const { prisma } = require("./db.service");
const contestClient = require("./contest-client.service");
const AppError = require("../utils/app-error");

const timersByRun = new Map();

function eventKey(event, index) {
  return [
    index,
    event.problemId,
    event.sequence ?? 0,
    event.atSeconds
  ].join(":");
}

function clearRunTimers(runId) {
  const timers = timersByRun.get(runId);

  if (timers) {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
  }

  timersByRun.delete(runId);
}

async function completeIfDone(runId) {
  const run = await prisma.botSimulationRun.findUnique({
    where: { id: runId }
  });

  if (!run) return;

  const events = Array.isArray(run.planJson?.events)
    ? run.planJson.events
    : [];

  const completed = new Set(
    run.executedEventKeys || []
  );

  const allDone = events.every((event, index) =>
    completed.has(eventKey(event, index))
  );

  if (allDone) {
    await prisma.botSimulationRun.update({
      where: { id: runId },
      data: {
        executed: true,
        executedAt: new Date(),
        mode: "LIVE_EXECUTED"
      }
    });

    clearRunTimers(runId);
  }
}

async function executeEvent({
  runId,
  event,
  index
}) {
  const key = eventKey(event, index);

  const run = await prisma.botSimulationRun.findUnique({
    where: { id: runId }
  });

  if (!run || run.executed) return;

  if ((run.executedEventKeys || []).includes(key)) {
    await completeIfDone(runId);
    return;
  }

  const contest =
    await contestClient.getContest(run.contestId);

  if (contest.status !== "RUNNING") {
    console.warn(
      `Skipping bot event ${key}: contest ${run.contestId} is ${contest.status}`
    );
    return;
  }

  if (!contest.startsAt) {
    throw new AppError(
      409,
      "Contest does not have a start time",
      "CONTEST_START_TIME_MISSING"
    );
  }

  const submittedAt = new Date(
    new Date(contest.startsAt).getTime() +
      event.atSeconds * 1000
  );

  const result = await contestClient.recordBotSubmission(
    run.contestId,
    {
      botId: run.botId,
      problemId: event.problemId,
      sourceCode: event.sourceCode,
      submittedAt: submittedAt.toISOString()
    }
  );

  const completedKeys = [key];
  if (result?.verdict === "AC") {
    const planEvents = Array.isArray(run.planJson?.events) ? run.planJson.events : [];
    for (const [futureIndex, futureEvent] of planEvents.entries()) {
      if (futureIndex <= index || futureEvent.problemId !== event.problemId) continue;
      const futureKey = eventKey(futureEvent, futureIndex);
      completedKeys.push(futureKey);
      const timer = timersByRun.get(runId)?.get(futureKey);
      if (timer) clearTimeout(timer);
      timersByRun.get(runId)?.delete(futureKey);
    }
  }

  await prisma.botSimulationRun.update({
    where: { id: runId },
    data: {
      executedEventKeys: { push: completedKeys }
    }
  });

  await completeIfDone(runId);
}

async function scheduleLiveSimulationRun(runId) {
  if (timersByRun.has(runId)) {
    return {
      runId,
      scheduled: true,
      alreadyScheduled: true
    };
  }

  const run = await prisma.botSimulationRun.findUnique({
    where: { id: runId }
  });

  if (!run) {
    throw new AppError(
      404,
      "Simulation run not found",
      "SIMULATION_RUN_NOT_FOUND"
    );
  }

  if (run.executed) {
    throw new AppError(
      409,
      "Simulation run has already been executed",
      "SIMULATION_ALREADY_EXECUTED"
    );
  }

  const contest =
    await contestClient.getContest(run.contestId);

  if (contest.status !== "RUNNING") {
    throw new AppError(
      409,
      "Contest must be RUNNING before live bot execution starts",
      "CONTEST_NOT_RUNNING"
    );
  }

  if (!contest.startsAt) {
    throw new AppError(
      409,
      "Contest does not have a start time",
      "CONTEST_START_TIME_MISSING"
    );
  }

  const events = Array.isArray(run.planJson?.events)
    ? run.planJson.events
    : [];

  const executed = new Set(
    run.executedEventKeys || []
  );

  const timers = new Map();
  const contestStartMs =
    new Date(contest.startsAt).getTime();

  for (const [index, event] of events.entries()) {
    const key = eventKey(event, index);

    if (executed.has(key)) continue;

    const dueAtMs =
      contestStartMs + event.atSeconds * 1000;

    const delay = Math.max(
      0,
      dueAtMs - Date.now()
    );

    // Contest duration is <= 24h, safely below Node's ~24.8 day
    // setTimeout signed-32-bit maximum.
    const timer = setTimeout(() => {
      executeEvent({
        runId,
        event,
        index
      }).catch((error) => {
        console.error(
          `Bot event execution failed for run ${runId}, event ${key}:`,
          error
        );
      });
    }, delay);

    timers.set(key, timer);
  }

  timersByRun.set(runId, timers);

  await prisma.botSimulationRun.update({
    where: { id: runId },
    data: {
      mode: "LIVE_SCHEDULED",
      liveStartedAt:
        run.liveStartedAt || new Date()
    }
  });

  if (timers.size === 0) {
    await completeIfDone(runId);
  }

  return {
    runId,
    scheduled: true,
    alreadyScheduled: false,
    remainingEvents: timers.size
  };
}

async function finishLiveSimulationRun(runId) {
  clearRunTimers(runId);
  const run = await prisma.botSimulationRun.findUnique({ where: { id: runId } });
  if (!run) throw new AppError(404, "Simulation run not found", "SIMULATION_RUN_NOT_FOUND");
  if (run.executed) return { runId, executed: true, executedEvents: 0 };

  const events = Array.isArray(run.planJson?.events) ? run.planJson.events : [];
  const completed = new Set(run.executedEventKeys || []);
  let executedEvents = 0;

  for (const [index, event] of events.entries()) {
    const key = eventKey(event, index);
    if (completed.has(key)) continue;
    await executeEvent({ runId, event, index });
    executedEvents += 1;
  }

  await completeIfDone(runId);
  return { runId, executed: true, executedEvents };
}

async function recoverLiveSimulationRuns() {
  const runs = await prisma.botSimulationRun.findMany({
    where: {
      mode: "LIVE_SCHEDULED",
      executed: false
    },
    select: { id: true }
  });

  const results = [];

  for (const run of runs) {
    try {
      results.push(
        await scheduleLiveSimulationRun(run.id)
      );
    } catch (error) {
      console.error(
        `Failed to recover live bot run ${run.id}:`,
        error.message
      );
    }
  }

  return results;
}

function shutdownLiveScheduler() {
  for (const runId of timersByRun.keys()) {
    clearRunTimers(runId);
  }
}

module.exports = {
  scheduleLiveSimulationRun,
  recoverLiveSimulationRuns,
  finishLiveSimulationRun,
  shutdownLiveScheduler,
  eventKey
};
