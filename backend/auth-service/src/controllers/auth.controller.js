const { z } = require("zod");

const authService = require("../services/auth.service");
const AppError = require("../utils/app-error");

const { verifyAccessToken } = require("../utils/jwt");

const { extractBearerToken } = require("../middleware/auth.middleware");

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),

  // User Service owns this value, but registration collects it so both
  // service records can be created as one user-facing operation.
  username: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),

  displayName: z.string().trim().max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid registration data",
      "VALIDATION_ERROR",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await authService.register(parsed.data);

  return res.status(201).json({
    success: true,
    data: result,
  });
}

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid login data",
      "VALIDATION_ERROR",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await authService.login(parsed.data);

  return res.status(200).json({
    success: true,
    data: result,
  });
}

async function me(req, res) {
  const user = await authService.getUserById(req.auth.userId);

  return res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
}

async function verify(req, res) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    throw new AppError(401, "Authentication required", "AUTH_REQUIRED");
  }

  try {
    const payload = verifyAccessToken(token);

    const user = await authService.getUserById(payload.sub);

    return res.status(200).json({
      success: true,
      data: {
        valid: true,
        user,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "Invalid or expired token", "INVALID_TOKEN");
  }
}

module.exports = {
  register,
  login,
  me,
  verify,
};
