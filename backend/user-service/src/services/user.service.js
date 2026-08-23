const { prisma } = require("./db.service");
const { calculateElo } = require("./rating.service");
const AppError = require("../utils/app-error");

const STAT_FIELDS = [
  "problemsSolved",
  "problemsAttempted",
  "contestsPlayed",
  "contestsWon",
  "botChallenges",
  "botWins",
  "submissions",
  "acceptedSubmissions",
];

function includeProfile() {
  return {
    stats: true,
    preferences: true,
  };
}

async function ensureUser(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: includeProfile(),
  });

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  return user;
}

async function createInternalProfile(input) {
  const existingById = await prisma.user.findUnique({
    where: { id: input.id },
    include: includeProfile(),
  });

  // Retry-safe: the same Auth user asking to create the same profile again
  // receives the existing record rather than a duplicate-key failure.
  if (existingById) {
    if (existingById.username !== input.username) {
      throw new AppError(
        409,
        "User ID already has a different username",
        "USER_ID_PROFILE_CONFLICT",
      );
    }

    return existingById;
  }

  const existingByUsername = await prisma.user.findUnique({
    where: { username: input.username },
  });

  if (existingByUsername) {
    throw new AppError(
      409,
      "Username is already taken",
      "USERNAME_ALREADY_EXISTS",
    );
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: input.id,
        username: input.username,
        displayName: input.displayName,
        bio: input.bio,
      },
    });

    await tx.userStats.create({
      data: { userId: user.id },
    });

    await tx.userPreferences.create({
      data: { userId: user.id },
    });

    return tx.user.findUnique({
      where: { id: user.id },
      include: includeProfile(),
    });
  });
}

async function getMe(userId) {
  return ensureUser(userId);
}

async function updateProfile(userId, data) {
  await ensureUser(userId);
  return prisma.user.update({
    where: { id: userId },
    data,
    include: includeProfile(),
  });
}

async function updatePreferences(userId, data) {
  await ensureUser(userId);
  return prisma.userPreferences.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

async function getStats(userId) {
  await ensureUser(userId);
  return prisma.userStats.findUnique({ where: { userId } });
}

async function getPublic(username) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: includeProfile(),
  });

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  if (user.preferences && user.preferences.showProfilePublic === false) {
    throw new AppError(403, "Profile is private", "PROFILE_PRIVATE");
  }

  return user;
}

async function setRating(userId, rating) {
  await ensureUser(userId);
  return prisma.user.update({
    where: { id: userId },
    data: { rating },
    include: includeProfile(),
  });
}

// Existing contract preserved: values are absolute setters.
async function setStats(userId, values) {
  await ensureUser(userId);

  return prisma.userStats.upsert({
    where: { userId },
    update: values,
    create: { userId, ...values },
  });
}

// New atomic API for service-driven events.
async function incrementStats(userId, deltas) {
  await ensureUser(userId);

  const data = {};
  for (const field of STAT_FIELDS) {
    if (deltas[field] !== undefined) {
      data[field] = { increment: deltas[field] };
    }
  }

  return prisma.userStats.update({
    where: { userId },
    data,
  });
}

async function getProcessedEvent(eventId) {
  const event = await prisma.userCompetitiveEvent.findUnique({
    where: { eventId },
  });

  if (!event) return null;

  const user = await prisma.user.findUnique({
    where: { id: event.userId },
    include: includeProfile(),
  });

  return { event, user };
}

async function applyChallengeResult({
  userId,
  eventId,
  opponentRating,
  result,
  statsDelta,
}) {
  const existing = await getProcessedEvent(eventId);
  if (existing) {
    return {
      idempotentReplay: true,
      event: existing.event,
      user: existing.user,
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
      }

      const stats = await tx.userStats.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      const rating = calculateElo({
        userRating: user.rating,
        opponentRating,
        result,
      });

      const statUpdate = {};
      for (const field of STAT_FIELDS) {
        const delta = statsDelta[field];
        if (delta !== undefined && delta !== 0) {
          statUpdate[field] = { increment: delta };
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          rating: rating.ratingAfter,
        },
      });

      if (Object.keys(statUpdate).length > 0) {
        await tx.userStats.update({
          where: { userId },
          data: statUpdate,
        });
      }

      const event = await tx.userCompetitiveEvent.create({
        data: {
          eventId,
          userId,
          eventType: "BOT_CHALLENGE_COMPLETED",
          opponentRating,
          result,
          ratingBefore: rating.ratingBefore,
          ratingAfter: rating.ratingAfter,
          ratingDelta: rating.ratingDelta,
          statsDeltaJson: statsDelta,
        },
      });

      const updatedUser = await tx.user.findUnique({
        where: { id: userId },
        include: includeProfile(),
      });

      return {
        idempotentReplay: false,
        event,
        user: updatedUser,
      };
    });
  } catch (error) {
    // Concurrent duplicate request: the unique event ID is the idempotency lock.
    if (error?.code === "P2002") {
      const replay = await getProcessedEvent(eventId);
      if (replay) {
        return {
          idempotentReplay: true,
          event: replay.event,
          user: replay.user,
        };
      }
    }

    throw error;
  }
}

module.exports = {
  createInternalProfile,
  getMe,
  updateProfile,
  updatePreferences,
  getStats,
  getPublic,
  setRating,
  setStats,
  incrementStats,
  applyChallengeResult,
};
