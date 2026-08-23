const { prisma } = require("./db.service");

const AppError = require("../utils/app-error");

const { hashPassword, verifyPassword } = require("../utils/password");

const { signAccessToken } = require("../utils/jwt");

const userClient = require("./user-client.service");

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function register({ email, password, username, displayName }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.authUser.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingUser) {
    throw new AppError(
      409,
      "An account with this email already exists",
      "EMAIL_ALREADY_EXISTS",
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.authUser.create({
    data: {
      email: normalizedEmail,
      passwordHash,
    },
  });

  try {
    const profile = await userClient.createProfile({
      id: user.id,
      username,
      displayName,
    });

    return {
      user: sanitizeUser(user),
      profile,
      accessToken: signAccessToken(user),
    };
  } catch (error) {
    // Compensating action: registration is not considered successful unless
    // both the Auth identity and User profile exist.
    //
    // Auth Service only deletes its own row; it never touches User DB directly.
    await prisma.authUser
      .delete({
        where: { id: user.id },
      })
      .catch((rollbackError) => {
        console.error(
          `Failed to roll back Auth user ${user.id} after User Service failure:`,
          rollbackError,
        );
      });

    throw error;
  }
}

async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.authUser.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  return {
    user: sanitizeUser(user),
    accessToken: signAccessToken(user),
  };
}

async function getUserById(id) {
  const user = await prisma.authUser.findUnique({
    where: {
      id,
    },
  });

  if (!user || !user.isActive) {
    throw new AppError(
      401,
      "User is not active or does not exist",
      "USER_NOT_ACTIVE",
    );
  }

  return sanitizeUser(user);
}

module.exports = {
  register,
  login,
  getUserById,
};
