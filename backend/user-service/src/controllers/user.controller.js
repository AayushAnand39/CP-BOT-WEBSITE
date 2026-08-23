const { z } = require("zod");
const service = require("../services/user.service");
const AppError = require("../utils/app-error");

const username = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/);

const profileSchema = z
  .object({
    username: username.optional(),
    displayName: z.string().trim().max(80).nullable().optional(),
    bio: z.string().max(500).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0);

const preferencesSchema = z
  .object({
    preferredLanguage: z
      .enum(["cpp", "java", "python", "javascript"])
      .optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    showProfilePublic: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0);

const createInternalSchema = z.object({
  id: z.string().min(1).max(100),
  username,
  displayName: z.string().trim().max(80).optional(),
  bio: z.string().max(500).optional(),
});

const statShape = {
  problemsSolved: z.number().int().nonnegative().optional(),
  problemsAttempted: z.number().int().nonnegative().optional(),
  contestsPlayed: z.number().int().nonnegative().optional(),
  contestsWon: z.number().int().nonnegative().optional(),
  botChallenges: z.number().int().nonnegative().optional(),
  botWins: z.number().int().nonnegative().optional(),
  submissions: z.number().int().nonnegative().optional(),
  acceptedSubmissions: z.number().int().nonnegative().optional(),
};

const setStatsSchema = z
  .object(statShape)
  .refine((data) => Object.keys(data).length > 0);

const incrementStatsSchema = z
  .object({
    problemsSolved: z.number().int().min(0).max(100000).optional(),
    problemsAttempted: z.number().int().min(0).max(100000).optional(),
    contestsPlayed: z.number().int().min(0).max(100000).optional(),
    contestsWon: z.number().int().min(0).max(100000).optional(),
    botChallenges: z.number().int().min(0).max(100000).optional(),
    botWins: z.number().int().min(0).max(100000).optional(),
    submissions: z.number().int().min(0).max(100000).optional(),
    acceptedSubmissions: z.number().int().min(0).max(100000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0);

const ratingSchema = z.object({
  rating: z.number().int().min(0).max(5000),
});

const challengeResultSchema = z.object({
  eventId: z.string().min(1).max(200),
  opponentRating: z.number().int().min(0).max(5000),
  result: z.enum(["WIN", "DRAW", "LOSS"]),
  statsDelta: incrementStatsSchema,
});

function parse(schema, value) {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid request data",
      "VALIDATION_ERROR",
      parsed.error.flatten().fieldErrors,
    );
  }

  return parsed.data;
}

async function me(req, res) {
  const result = await service.getMe(req.auth.userId);

  const { stats, preferences, ...user } = result;

  res.json({
    success: true,
    data: {
      user,
      stats,
      preferences,
    },
  });
}

async function updateMe(req, res) {
  const data = parse(profileSchema, req.body);
  res.json({
    success: true,
    data: { user: await service.updateProfile(req.auth.userId, data) },
  });
}

async function updatePreferences(req, res) {
  const data = parse(preferencesSchema, req.body);
  res.json({
    success: true,
    data: {
      preferences: await service.updatePreferences(req.auth.userId, data),
    },
  });
}

async function stats(req, res) {
  res.json({
    success: true,
    data: { stats: await service.getStats(req.auth.userId) },
  });
}

async function publicProfile(req, res) {
  res.json({
    success: true,
    data: { user: await service.getPublic(req.params.username) },
  });
}

async function createInternal(req, res) {
  const data = parse(createInternalSchema, req.body);
  res
    .status(201)
    .json({
      success: true,
      data: { user: await service.createInternalProfile(data) },
    });
}

async function ratingInternal(req, res) {
  const data = parse(ratingSchema, req.body);
  res.json({
    success: true,
    data: { user: await service.setRating(req.params.userId, data.rating) },
  });
}

async function statsInternal(req, res) {
  const data = parse(setStatsSchema, req.body);
  res.json({
    success: true,
    data: { stats: await service.setStats(req.params.userId, data) },
  });
}

async function statsIncrementInternal(req, res) {
  const data = parse(incrementStatsSchema, req.body);
  res.json({
    success: true,
    data: { stats: await service.incrementStats(req.params.userId, data) },
  });
}

async function challengeResultInternal(req, res) {
  const data = parse(challengeResultSchema, req.body);

  const result = await service.applyChallengeResult({
    userId: req.params.userId,
    ...data,
  });

  res.json({
    success: true,
    data: result,
  });
}

module.exports = {
  me,
  updateMe,
  updatePreferences,
  stats,
  publicProfile,
  createInternal,
  ratingInternal,
  statsInternal,
  statsIncrementInternal,
  challengeResultInternal,
};
