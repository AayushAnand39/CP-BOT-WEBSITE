const { prisma } = require("./db.service");
const problemClient = require("./problem-client.service");
const judgeClient = require("./judge-client.service");
const testcaseClient = require("./testcase-client.service");
const { seededShuffle } = require("../utils/seeded-random");
const AppError = require("../utils/app-error");

function serializeContest(contest) {
  return {
    ...contest,
    seed: contest.seed?.toString?.() ?? String(contest.seed),
  };
}

function sanitizeJudgeResult(judged) {
  return {
    verdict: judged?.verdict || judged?.overallVerdict || null,
    executionTimeMs:
      judged?.executionTimeMs ?? judged?.totalExecutionTimeMs ?? null,
    compilationError: judged?.compilationError || null,
    tests: Array.isArray(judged?.tests)
      ? judged.tests.map((test, index) => ({
          testNumber: Number(test?.testNumber) || index + 1,
          verdict: String(test?.verdict || "PENDING"),
          timeMs: test?.timeMs == null ? null : Number(test.timeMs),
        }))
      : [],
  };
}

async function createContest(input) {
  if (input.difficultyMin > input.difficultyMax) {
    throw new AppError(
      400,
      "difficultyMin cannot exceed difficultyMax",
      "INVALID_DIFFICULTY_RANGE",
    );
  }

  let effectiveMin = input.difficultyMin;
  let effectiveMax = input.difficultyMax;

  let candidates = await problemClient.getEligibleProblems({
    ratingMin: effectiveMin,
    ratingMax: effectiveMax,
  });

  let eligible = candidates.filter(
    (p) =>
      p.status === "READY" &&
      p.deterministic === true &&
      Number.isInteger(p.rating) &&
      p.rating >= effectiveMin &&
      p.rating <= effectiveMax,
  );

  // If there are not enough problems, gradually widen upward.
  // Keep the lower bound intact so contests still start from easier problems.
  const MAX_EXPANSION_RATING = 800;

  let expansion = 0;

  while (
    eligible.length < input.problemCount &&
    expansion < MAX_EXPANSION_RATING
  ) {
    expansion += 100;

    effectiveMax = input.difficultyMax + expansion;

    candidates = await problemClient.getEligibleProblems({
      ratingMin: effectiveMin,
      ratingMax: effectiveMax,
    });

    eligible = candidates.filter(
      (p) =>
        p.status === "READY" &&
        p.deterministic === true &&
        Number.isInteger(p.rating) &&
        p.rating >= effectiveMin &&
        p.rating <= effectiveMax,
    );
  }

  if (eligible.length < input.problemCount) {
    throw new AppError(
      409,
      `Only ${eligible.length} eligible problems available even after expanding rating range to ${effectiveMin}-${effectiveMax}. Requested ${input.problemCount}.`,
      "INSUFFICIENT_ELIGIBLE_PROBLEMS",
    );
  }
  // Build an ascending difficulty ladder instead of choosing all problems from the
  // same narrow random cluster. For N problems, target N evenly spaced ratings
  // across the requested range and choose the nearest unused candidate for each.
  eligible.sort(
    (a, b) => a.rating - b.rating || String(a.id).localeCompare(String(b.id)),
  );
  const shuffled = seededShuffle(eligible, input.seed);
  const remaining = new Map(shuffled.map((p) => [p.id, p]));
  const selected = [];
  for (let i = 0; i < input.problemCount; i++) {
    const fraction =
      input.problemCount === 1 ? 0.5 : i / (input.problemCount - 1);

    const target = effectiveMin + (effectiveMax - effectiveMin) * fraction;
    const candidate = [...remaining.values()].sort((a, b) => {
      const da = Math.abs(a.rating - target);
      const db = Math.abs(b.rating - target);
      return (
        da - db ||
        a.rating - b.rating ||
        String(a.id).localeCompare(String(b.id))
      );
    })[0];
    selected.push(candidate);
    remaining.delete(candidate.id);
  }
  selected.sort(
    (a, b) => a.rating - b.rating || String(a.id).localeCompare(String(b.id)),
  );
  const status = input.startsAt ? "SCHEDULED" : "DRAFT";
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = startsAt
    ? new Date(startsAt.getTime() + input.durationSeconds * 1000)
    : null;
  const contest = await prisma.contest.create({
    data: {
      name: input.name,
      description: input.description,
      seed: BigInt(input.seed),
      difficultyMin: effectiveMin,
      difficultyMax: effectiveMax,
      problemCount: input.problemCount,
      durationSeconds: input.durationSeconds,
      startsAt,
      endsAt,
      status,
      problems: {
        create: selected.map((p, index) => ({
          problemId: p.id,
          ordinal: index + 1,
          problemRating: p.rating,
        })),
      },
    },
    include: { problems: { orderBy: { ordinal: "asc" } } },
  });
  return serializeContest(contest);
}

async function listContests({ status }) {
  const contests = await prisma.contest.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { participants: true } } },
  });
  return contests.map(serializeContest);
}

async function getContest(id, includeProblems = true) {
  const contest = await prisma.contest.findUnique({
    where: { id },
    include: includeProblems
      ? { problems: { orderBy: { ordinal: "asc" } } }
      : undefined,
  });
  if (!contest)
    throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");
  return serializeContest(contest);
}

function publicProblem(problem) {
  const allowed = [
    "id",
    "source",
    "sourceContestId",
    "sourceIndex",
    "title",
    "rating",
    "tags",
    "concepts",
    "statement",
    "inputFormat",
    "outputFormat",
    "constraints",
    "examplesJson",
    "notes",
    "editorial",
    "timeLimitMs",
    "memoryLimitMb",
    "deterministic",
    "status",
    "createdAt",
    "updatedAt",
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => problem[key] !== undefined)
      .map((key) => [key, problem[key]]),
  );
}

async function getContestProblemDetails(contestId, problemId) {
  const link = await prisma.contestProblem.findUnique({
    where: { contestId_problemId: { contestId, problemId } },
  });
  if (!link)
    throw new AppError(
      404,
      "Problem is not part of this contest",
      "PROBLEM_NOT_IN_CONTEST",
    );
  const problem = await problemClient.getProblemPublic(problemId);
  if (problem.status !== "READY")
    throw new AppError(409, "Problem is not ready", "PROBLEM_NOT_READY");
  return publicProblem(problem);
}

async function startContest(id) {
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest)
    throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");
  if (!["DRAFT", "SCHEDULED"].includes(contest.status))
    throw new AppError(
      409,
      `Cannot start contest from ${contest.status}`,
      "INVALID_CONTEST_STATE",
    );
  const now = new Date();
  const updated = await prisma.contest.update({
    where: { id },
    data: {
      status: "RUNNING",
      startsAt: now,
      endsAt: new Date(now.getTime() + contest.durationSeconds * 1000),
    },
  });
  return serializeContest(updated);
}

async function endContest(id) {
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest)
    throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");
  if (contest.status !== "RUNNING")
    throw new AppError(
      409,
      "Only a running contest can be ended",
      "INVALID_CONTEST_STATE",
    );
  await recomputeStandings(id);
  const updated = await prisma.contest.update({
    where: { id },
    data: { status: "ENDED", endsAt: new Date() },
  });

  await prisma.botChallenge.updateMany({
    where: { contestId: id },
    data: { status: "ENDED" },
  });

  return serializeContest(updated);
}

async function cancelContest(id) {
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest)
    throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");
  if (["ENDED", "CANCELLED"].includes(contest.status))
    throw new AppError(
      409,
      `Cannot cancel contest from ${contest.status}`,
      "INVALID_CONTEST_STATE",
    );
  const updated = await prisma.contest.update({
    where: { id },
    data: { status: "CANCELLED", endsAt: new Date() },
  });

  await prisma.botChallenge.updateMany({
    where: { contestId: id },
    data: { status: "CANCELLED" },
  });

  return serializeContest(updated);
}

async function joinContest(contestId, participantId, type = "USER") {
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  if (!contest)
    throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");
  if (["ENDED", "CANCELLED"].includes(contest.status))
    throw new AppError(
      409,
      "Contest no longer accepts participants",
      "CONTEST_CLOSED",
    );
  return prisma.contestParticipant.upsert({
    where: { contestId_participantId_type: { contestId, participantId, type } },
    update: {},
    create: { contestId, participantId, type },
  });
}

async function getStandings(contestId) {
  await getContest(contestId, false);
  return prisma.contestParticipant.findMany({
    where: { contestId },
    orderBy: [{ score: "desc" }, { penalty: "asc" }, { joinedAt: "asc" }],
  });
}

async function recomputeStandings(contestId) {
  const participants = await prisma.contestParticipant.findMany({
    where: { contestId },
    orderBy: [{ score: "desc" }, { penalty: "asc" }, { joinedAt: "asc" }],
  });
  await prisma.$transaction(
    participants.map((p, i) =>
      prisma.contestParticipant.update({
        where: { id: p.id },
        data: { rank: i + 1 },
      }),
    ),
  );
  return participants.map((p, i) => ({ ...p, rank: i + 1 }));
}

async function applyAcceptedScore(
  contestId,
  participantRowId,
  problemId,
  submittedAt,
  currentSubmissionId = null,
) {
  const alreadyAccepted = await prisma.submission.findFirst({
    where: {
      contestId,
      participantRowId,
      problemId,
      verdict: "AC",
      ...(currentSubmissionId ? { id: { not: currentSubmissionId } } : {}),
    },
  });
  if (alreadyAccepted) return false;
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  const wrongAttempts = await prisma.submission.count({
    where: {
      contestId,
      participantRowId,
      problemId,
      verdict: { in: ["WA", "TLE", "MLE", "RE", "CE"] },
      submittedAt: { lt: submittedAt },
    },
  });
  const elapsedMinutes = Math.max(
    0,
    Math.floor((submittedAt.getTime() - contest.startsAt.getTime()) / 60000),
  );
  const penaltyDelta = elapsedMinutes + wrongAttempts * 20;
  await prisma.contestParticipant.update({
    where: { id: participantRowId },
    data: { score: { increment: 1 }, penalty: { increment: penaltyDelta } },
  });
  return true;
}

async function requireUserParticipant(contestId, userId) {
  const participant = await prisma.contestParticipant.findUnique({
    where: {
      contestId_participantId_type: {
        contestId,
        participantId: userId,
        type: "USER",
      },
    },
  });
  if (!participant)
    throw new AppError(
      403,
      "Join the contest before running or submitting code",
      "NOT_A_PARTICIPANT",
    );
  return participant;
}

async function resolveHiddenTests(problemId) {
  const problem = await problemClient.getProblemInternal(problemId);
  const artifact = problem.testcaseArtifactJson || {};
  let tests = [];
  if (Array.isArray(artifact.tests) && artifact.tests.length) {
    tests = artifact.tests.map((t) => ({
      input: String(t.input ?? ""),
      expectedOutput: String(t.expectedOutput ?? t.output ?? ""),
    }));
  } else if (artifact.jobId) {
    tests = await testcaseClient.getTests(artifact.jobId);
  }
  if (!tests.length)
    throw new AppError(
      409,
      "No hidden testcase artifact is available for this problem",
      "HIDDEN_TESTCASES_NOT_AVAILABLE",
    );
  return { problem, tests };
}

async function assertRunnableProblem(contestId, userId, problemId) {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: { problems: true },
  });
  if (!contest)
    throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");
  if (!contest.problems.some((p) => p.problemId === problemId))
    throw new AppError(
      400,
      "Problem does not belong to contest",
      "PROBLEM_NOT_IN_CONTEST",
    );
  await requireUserParticipant(contestId, userId);
  return { contest, problem: await problemClient.getProblemPublic(problemId) };
}

async function runSamples({
  contestId,
  userId,
  problemId,
  language,
  sourceCode,
}) {
  const { problem } = await assertRunnableProblem(contestId, userId, problemId);
  const examples = Array.isArray(problem.examplesJson)
    ? problem.examplesJson
    : [];
  if (!examples.length)
    throw new AppError(
      409,
      "This problem has no sample testcases",
      "NO_SAMPLE_TESTCASES",
    );
  const tests = examples.map((sample) => ({
    input: String(sample.input ?? ""),
    expectedOutput: String(sample.output ?? ""),
  }));
  return judgeClient.judgeSubmission({
    language,
    sourceCode,
    tests,
    executionTimeoutMs: Math.min(
      Math.max(problem.timeLimitMs || 3000, 250),
      30000,
    ),
  });
}

async function runCode({
  contestId,
  userId,
  problemId,
  language,
  sourceCode,
  input,
  expectedOutput,
}) {
  const { problem } = await assertRunnableProblem(contestId, userId, problemId);
  return judgeClient.runCode({
    language,
    sourceCode,
    input: String(input ?? ""),
    ...(expectedOutput !== undefined
      ? { expectedOutput: String(expectedOutput) }
      : {}),
    executionTimeoutMs: Math.min(
      Math.max(problem.timeLimitMs || 3000, 250),
      30000,
    ),
  });
}

async function submit({ contestId, userId, problemId, language, sourceCode }) {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: { problems: true },
  });
  if (!contest)
    throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");
  if (contest.status !== "RUNNING")
    throw new AppError(409, "Contest is not running", "CONTEST_NOT_RUNNING");
  if (contest.endsAt && new Date() >= contest.endsAt)
    throw new AppError(409, "Contest time has ended", "CONTEST_TIME_ENDED");
  if (!contest.problems.some((p) => p.problemId === problemId))
    throw new AppError(
      400,
      "Problem does not belong to contest",
      "PROBLEM_NOT_IN_CONTEST",
    );
  const participant = await requireUserParticipant(contestId, userId);
  const submission = await prisma.submission.create({
    data: {
      contestId,
      participantRowId: participant.id,
      problemId,
      sourceCode,
      language,
      verdict: "PENDING",
    },
  });
  try {
    const { problem, tests } = await resolveHiddenTests(problemId);
    const judged = await judgeClient.judgeSubmission({
      language,
      sourceCode,
      tests,
      executionTimeoutMs: Math.min(
        Math.max(problem.timeLimitMs || 3000, 250),
        30000,
      ),
    });
    const verdict = judged.verdict || judged.overallVerdict;
    const executionTimeMs =
      judged.executionTimeMs ??
      judged.totalExecutionTimeMs ??
      judged.tests?.reduce((m, t) => Math.max(m, Number(t.timeMs) || 0), 0) ??
      null;
    if (!verdict || !["AC", "WA", "TLE", "MLE", "RE", "CE"].includes(verdict))
      throw new AppError(
        502,
        "Judge response did not contain a valid verdict",
        "INVALID_JUDGE_RESPONSE",
      );
    const safeJudge = sanitizeJudgeResult(judged);
    let updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        verdict,
        score: 0,
        executionTimeMs:
          executionTimeMs == null ? null : Math.round(executionTimeMs),
        testResultsJson: safeJudge.tests,
        judgedAt: new Date(),
      },
    });
    let awarded = false;
    if (verdict === "AC") {
      awarded = await applyAcceptedScore(
        contestId,
        participant.id,
        problemId,
        updated.submittedAt,
        updated.id,
      );
      if (awarded)
        updated = await prisma.submission.update({
          where: { id: updated.id },
          data: { score: 1 },
        });
    }
    await recomputeStandings(contestId);
    return { ...updated, judge: safeJudge };
  } catch (error) {
    // Preserve PENDING only for infrastructure failures. Do not invent an RE verdict.
    await prisma.submission
      .update({ where: { id: submission.id }, data: { judgedAt: new Date() } })
      .catch(() => {});
    throw error;
  }
}

async function recordBotSubmission({
  contestId,
  botId,
  problemId,
  sourceCode,
  submittedAt,
}) {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: { problems: true },
  });

  if (!contest || contest.status !== "RUNNING") {
    throw new AppError(409, "Contest is not running", "CONTEST_NOT_RUNNING");
  }
  if (!contest.problems.some((p) => p.problemId === problemId)) {
    throw new AppError(
      400,
      "Problem does not belong to contest",
      "PROBLEM_NOT_IN_CONTEST",
    );
  }

  const effectiveSubmittedAt = submittedAt ? new Date(submittedAt) : new Date();
  if (Number.isNaN(effectiveSubmittedAt.getTime())) {
    throw new AppError(
      400,
      "Invalid bot submission timestamp",
      "INVALID_SUBMISSION_TIME",
    );
  }
  if (contest.startsAt && effectiveSubmittedAt < contest.startsAt) {
    throw new AppError(
      400,
      "Bot submission cannot be before contest start",
      "SUBMISSION_BEFORE_CONTEST",
    );
  }
  if (contest.endsAt && effectiveSubmittedAt > contest.endsAt) {
    throw new AppError(
      400,
      "Bot submission cannot be after contest end",
      "SUBMISSION_AFTER_CONTEST",
    );
  }

  const challenge = await prisma.botChallenge.findUnique({
    where: { contestId },
    select: { botId: true },
  });
  if (challenge && challenge.botId !== botId) {
    throw new AppError(
      409,
      "Bot submission does not match this challenge's bot",
      "BOT_PARTICIPANT_MISMATCH",
    );
  }

  const participant = await prisma.contestParticipant.findUnique({
    where: {
      contestId_participantId_type: {
        contestId,
        participantId: botId,
        type: "BOT",
      },
    },
  });
  if (!participant) {
    throw new AppError(
      409,
      "Bot participant is missing from this contest",
      "BOT_PARTICIPANT_MISSING",
    );
  }

  const submission = await prisma.submission.create({
    data: {
      contestId,
      participantRowId: participant.id,
      problemId,
      sourceCode,
      language: "cpp",
      verdict: "PENDING",
      score: 0,
      submittedAt: effectiveSubmittedAt,
    },
  });

  try {
    // Bot submissions use exactly the same hidden-test judge path as user code.
    // No simulated verdict or fabricated execution time is trusted.
    const { problem, tests } = await resolveHiddenTests(problemId);
    const judged = await judgeClient.judgeSubmission({
      language: "cpp",
      sourceCode,
      tests,
      executionTimeoutMs: Math.min(
        Math.max(problem.timeLimitMs || 3000, 250),
        30000,
      ),
    });

    const verdict = judged.verdict || judged.overallVerdict;
    if (!verdict || !["AC", "WA", "TLE", "MLE", "RE", "CE"].includes(verdict)) {
      throw new AppError(
        502,
        "Judge response did not contain a valid verdict",
        "INVALID_JUDGE_RESPONSE",
      );
    }
    const safeJudge = sanitizeJudgeResult(judged);
    const executionTimeMs =
      judged.executionTimeMs ??
      judged.totalExecutionTimeMs ??
      judged.tests?.reduce((m, t) => Math.max(m, Number(t.timeMs) || 0), 0) ??
      null;

    let updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        verdict,
        executionTimeMs:
          executionTimeMs == null ? null : Math.round(executionTimeMs),
        testResultsJson: safeJudge.tests,
        judgedAt: new Date(),
      },
    });

    if (verdict === "AC") {
      const awarded = await applyAcceptedScore(
        contestId,
        participant.id,
        problemId,
        updated.submittedAt,
        updated.id,
      );
      if (awarded) {
        updated = await prisma.submission.update({
          where: { id: updated.id },
          data: { score: 1 },
        });
      }
    }

    await recomputeStandings(contestId);
    return {
      ...updated,
      judge: safeJudge,
      hiddenTestsExecuted: safeJudge.tests.length,
      hiddenTestsPassed: safeJudge.tests.filter((test) => test.verdict === "AC")
        .length,
    };
  } catch (error) {
    await prisma.submission
      .update({
        where: { id: submission.id },
        data: { judgedAt: new Date() },
      })
      .catch(() => {});
    throw error;
  }
}

async function getSubmission(contestId, userId, submissionId) {
  await requireUserParticipant(contestId, userId);
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { status: true },
  });
  if (!contest)
    throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, contestId },
    include: {
      participant: { select: { participantId: true, type: true } },
      contestProblem: { select: { ordinal: true, problemRating: true } },
    },
  });
  if (!submission)
    throw new AppError(404, "Submission not found", "SUBMISSION_NOT_FOUND");
  if (submission.participant.type === "BOT" && contest.status !== "ENDED") {
    throw new AppError(
      403,
      "Bot source code becomes available after the contest ends",
      "BOT_SOURCE_LOCKED",
    );
  }
  return {
    id: submission.id,
    problemId: submission.problemId,
    problemOrdinal: submission.contestProblem.ordinal,
    participantId: submission.participant.participantId,
    participantType: submission.participant.type,
    actor: submission.participant.type === "BOT" ? "BOT" : "YOU",
    language: submission.language,
    sourceCode: submission.sourceCode,
    verdict: submission.verdict,
    score: submission.score,
    executionTimeMs: submission.executionTimeMs,
    hiddenTests: Array.isArray(submission.testResultsJson)
      ? submission.testResultsJson
      : [],
    submittedAt: submission.submittedAt,
    judgedAt: submission.judgedAt,
  };
}

async function getActivity(contestId, userId) {
  const participant = await prisma.contestParticipant.findUnique({
    where: {
      contestId_participantId_type: {
        contestId,
        participantId: userId,
        type: "USER",
      },
    },
  });
  if (!participant) {
    throw new AppError(
      403,
      "You are not a participant in this contest",
      "NOT_A_PARTICIPANT",
    );
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { id: true, startsAt: true },
  });
  if (!contest)
    throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");

  const submissions = await prisma.submission.findMany({
    where: { contestId },
    orderBy: { submittedAt: "asc" },
    include: {
      participant: {
        select: { participantId: true, type: true, score: true, penalty: true },
      },
      contestProblem: { select: { ordinal: true, problemRating: true } },
    },
  });

  return submissions.map((submission) => ({
    id: submission.id,
    problemId: submission.problemId,
    problemOrdinal: submission.contestProblem.ordinal,
    problemRating: submission.contestProblem.problemRating,
    participantType: submission.participant.type,
    participantId: submission.participant.participantId,
    actor: submission.participant.type === "BOT" ? "BOT" : "YOU",
    verdict: submission.verdict,
    executionTimeMs: submission.executionTimeMs,
    submittedAt: submission.submittedAt,
    elapsedSeconds: contest.startsAt
      ? Math.max(
          0,
          Math.floor(
            (submission.submittedAt.getTime() - contest.startsAt.getTime()) /
              1000,
          ),
        )
      : null,
    pointsEarned: submission.score,
    hiddenTestsExecuted: Array.isArray(submission.testResultsJson)
      ? submission.testResultsJson.length
      : 0,
    hiddenTestsPassed: Array.isArray(submission.testResultsJson)
      ? submission.testResultsJson.filter((test) => test?.verdict === "AC")
          .length
      : 0,
  }));
}

module.exports = {
  createContest,
  listContests,
  getContest,
  getContestProblemDetails,
  startContest,
  endContest,
  cancelContest,
  joinContest,
  getStandings,
  getActivity,
  getSubmission,
  runSamples,
  runCode,
  submit,
  recordBotSubmission,
  recomputeStandings,
  serializeContest,
};
