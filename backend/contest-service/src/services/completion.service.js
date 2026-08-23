const { prisma } = require("./db.service");
const contestService = require("./contest.service");
const userClient = require("./user-client.service");
const AppError = require("../utils/app-error");

function compareUserToBot(user, bot) {
  if (user.score > bot.score) return "WIN";
  if (user.score < bot.score) return "LOSS";

  if (user.penalty < bot.penalty) return "WIN";
  if (user.penalty > bot.penalty) return "LOSS";

  return "DRAW";
}

async function buildUserStatsDelta(contestId, userParticipantId, outcome) {
  const submissions = await prisma.submission.findMany({
    where: {
      contestId,
      participantRowId: userParticipantId
    },
    select: {
      problemId: true,
      verdict: true
    }
  });

  const attemptedProblems = new Set();
  const solvedProblems = new Set();
  let acceptedSubmissions = 0;

  for (const submission of submissions) {
    attemptedProblems.add(submission.problemId);

    if (submission.verdict === "AC") {
      solvedProblems.add(submission.problemId);
      acceptedSubmissions += 1;
    }
  }

  return {
    problemsSolved: solvedProblems.size,
    problemsAttempted: attemptedProblems.size,
    contestsPlayed: 1,
    contestsWon: outcome === "WIN" ? 1 : 0,
    botChallenges: 1,
    botWins: outcome === "WIN" ? 1 : 0,
    submissions: submissions.length,
    acceptedSubmissions
  };
}

async function applyChallengeCompletion(contestId) {
  const challenge = await prisma.botChallenge.findUnique({
    where: { contestId }
  });

  if (!challenge) {
    return null;
  }

  // Result already committed to User Service and recorded locally.
  if (challenge.resultAppliedAt) {
    return challenge;
  }

  const participants = await prisma.contestParticipant.findMany({
    where: { contestId }
  });

  const user = participants.find(
    (p) =>
      p.type === "USER" &&
      p.participantId === challenge.userId
  );

  const bot = participants.find(
    (p) =>
      p.type === "BOT" &&
      p.participantId === challenge.botId
  );

  if (!user || !bot) {
    throw new AppError(
      409,
      "Challenge participants are incomplete",
      "CHALLENGE_PARTICIPANTS_INCOMPLETE"
    );
  }

  const outcome = compareUserToBot(user, bot);

  const statsDelta = await buildUserStatsDelta(
    contestId,
    user.id,
    outcome
  );

  const eventId =
    challenge.resultEventId ||
    `bot-challenge:${challenge.id}:completion`;

  // User Service is idempotent on eventId. If this call succeeds but the
  // response is lost, retrying this exact event will not double-apply stats.
  const result = await userClient.applyChallengeResult({
    userId: challenge.userId,
    eventId,
    opponentRating: challenge.botRating,
    result: outcome,
    statsDelta
  });

  const event = result.event;

  return prisma.botChallenge.update({
    where: { id: challenge.id },
    data: {
      status: "ENDED",
      outcome,
      resultEventId: eventId,
      ratingBefore: event.ratingBefore,
      ratingAfter: event.ratingAfter,
      ratingDelta: event.ratingDelta,
      resultAppliedAt: new Date(),
      completedAt: new Date()
    }
  });
}

async function completeContest(contestId, { forceEnd = false } = {}) {
  let contest = await prisma.contest.findUnique({
    where: { id: contestId }
  });

  if (!contest) {
    throw new AppError(
      404,
      "Contest not found",
      "CONTEST_NOT_FOUND"
    );
  }

  if (contest.status === "RUNNING") {
    // Scheduler reaches here at endsAt. Manual internal end may use forceEnd.
    if (!forceEnd && contest.endsAt && new Date() < contest.endsAt) {
      throw new AppError(
        409,
        "Contest has not reached its end time",
        "CONTEST_NOT_FINISHED"
      );
    }

    contest = await contestService.endContest(contestId);
  } else if (contest.status !== "ENDED") {
    throw new AppError(
      409,
      `Cannot complete contest from ${contest.status}`,
      "INVALID_CONTEST_STATE"
    );
  }

  const challenge = await applyChallengeCompletion(contestId);

  return {
    contest,
    challenge
  };
}

module.exports = {
  compareUserToBot,
  buildUserStatsDelta,
  applyChallengeCompletion,
  completeContest
};
