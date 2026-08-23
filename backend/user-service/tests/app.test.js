const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const { env } = require("../src/config/env");
const { prisma } = require("../src/services/db.service");

const TEST_USER_ID = `test-user-${Date.now()}`;
const TEST_USERNAME = `testuser_${Date.now()}`;

function createToken(userId = TEST_USER_ID) {
  return jwt.sign(
    {
      sub: userId,
      email: "test@example.com",
      type: "access"
    },
    env.JWT_SECRET,
    {
      issuer: "cp-bot-auth-service",
      audience: "cp-bot-platform",
      expiresIn: "1h"
    }
  );
}

const token = createToken();

async function createTestUser() {
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      username: TEST_USERNAME,
      displayName: "Test User",
      bio: "Testing User Service"
    }
  });

  await prisma.userStats.create({
    data: {
      userId: TEST_USER_ID
    }
  });

  await prisma.userPreferences.create({
    data: {
      userId: TEST_USER_ID
    }
  });
}

async function cleanup() {
  await prisma.userPreferences.deleteMany({
    where: {
      userId: TEST_USER_ID
    }
  });

  await prisma.userStats.deleteMany({
    where: {
      userId: TEST_USER_ID
    }
  });

  await prisma.user.deleteMany({
    where: {
      id: TEST_USER_ID
    }
  });
}

test.before(async () => {
  await cleanup();
  await createTestUser();
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});


/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

test("GET /health returns service health", async () => {
  const response = await request(app)
    .get("/health");

  assert.equal(response.status, 200);

  assert.deepEqual(response.body, {
    success: true,
    service: "user-service",
    status: "ok"
  });
});


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

test("GET /api/v1/users/me rejects unauthenticated requests", async () => {
  const response = await request(app)
    .get("/api/v1/users/me");

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "AUTH_REQUIRED");
});


test("GET /api/v1/users/me rejects invalid JWT", async () => {
  const response = await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", "Bearer invalid-token");

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "INVALID_TOKEN");
});


/*
|--------------------------------------------------------------------------
| Get Current User
|--------------------------------------------------------------------------
*/

test("GET /api/v1/users/me returns authenticated user", async () => {
  const response = await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const { user, stats, preferences } = response.body.data;

  assert.equal(user.id, TEST_USER_ID);
  assert.equal(user.username, TEST_USERNAME);
  assert.equal(user.displayName, "Test User");

  assert.equal(stats.userId, TEST_USER_ID);
  assert.equal(stats.problemsSolved, 0);

  assert.equal(preferences.userId, TEST_USER_ID);
  assert.equal(preferences.preferredLanguage, "cpp");
});


/*
|--------------------------------------------------------------------------
| Update Profile
|--------------------------------------------------------------------------
*/

test("PATCH /api/v1/users/me updates profile", async () => {
  const response = await request(app)
    .patch("/api/v1/users/me")
    .set("Authorization", `Bearer ${token}`)
    .send({
      displayName: "Updated User",
      bio: "Updated biography"
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const user = response.body.data.user;

  assert.equal(user.displayName, "Updated User");
  assert.equal(user.bio, "Updated biography");
});


test("PATCH /api/v1/users/me rejects invalid username", async () => {
  const response = await request(app)
    .patch("/api/v1/users/me")
    .set("Authorization", `Bearer ${token}`)
    .send({
      username: "ab"
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});


test("PATCH /api/v1/users/me rejects invalid username characters", async () => {
  const response = await request(app)
    .patch("/api/v1/users/me")
    .set("Authorization", `Bearer ${token}`)
    .send({
      username: "test user!"
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});


/*
|--------------------------------------------------------------------------
| Preferences
|--------------------------------------------------------------------------
*/

test("PATCH /api/v1/users/me/preferences updates preferences", async () => {
  const response = await request(app)
    .patch("/api/v1/users/me/preferences")
    .set("Authorization", `Bearer ${token}`)
    .send({
      preferredLanguage: "java",
      theme: "dark",
      showProfilePublic: false
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const preferences = response.body.data.preferences;

  assert.equal(preferences.preferredLanguage, "java");
  assert.equal(preferences.theme, "dark");
  assert.equal(preferences.showProfilePublic, false);
});


test("PATCH /api/v1/users/me/preferences rejects invalid theme", async () => {
  const response = await request(app)
    .patch("/api/v1/users/me/preferences")
    .set("Authorization", `Bearer ${token}`)
    .send({
      theme: "blue"
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});


/*
|--------------------------------------------------------------------------
| Statistics
|--------------------------------------------------------------------------
*/

test("GET /api/v1/users/me/stats returns statistics", async () => {
  const response = await request(app)
    .get("/api/v1/users/me/stats")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  assert.equal(
    response.body.data.stats.userId,
    TEST_USER_ID
  );
});


/*
|--------------------------------------------------------------------------
| Public Profile
|--------------------------------------------------------------------------
*/

test("GET /api/v1/users/public/:username returns public profile", async () => {
  // Make profile public first.
  await prisma.userPreferences.update({
    where: {
      userId: TEST_USER_ID
    },
    data: {
      showProfilePublic: true
    }
  });

  const response = await request(app)
    .get(`/api/v1/users/public/${TEST_USERNAME}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const user = response.body.data.user;

  assert.equal(user.id, TEST_USER_ID);
  assert.equal(user.username, TEST_USERNAME);
});


test("GET /api/v1/users/public/:username returns 404 for unknown user", async () => {
  const response = await request(app)
    .get("/api/v1/users/public/does_not_exist");

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "USER_NOT_FOUND");
});


test("public profile rejects private profile", async () => {
  await prisma.userPreferences.update({
    where: {
      userId: TEST_USER_ID
    },
    data: {
      showProfilePublic: false
    }
  });

  const response = await request(app)
    .get(`/api/v1/users/public/${TEST_USERNAME}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "PROFILE_PRIVATE");
});


/*
|--------------------------------------------------------------------------
| Internal Service APIs
|--------------------------------------------------------------------------
*/

test("internal profile creation rejects missing service token", async () => {
  const response = await request(app)
    .post("/api/v1/users/internal/users")
    .send({
      id: "another-test-user",
      username: "anotheruser"
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "INVALID_SERVICE_TOKEN");
});


test("internal profile creation works with service token", async () => {
  const userId = `internal-test-${Date.now()}`;
  const username = `int_${Date.now().toString().slice(-10)}`;

  const response = await request(app)
    .post("/api/v1/users/internal/users")
    .set(
      "X-Internal-Service-Token",
      env.INTERNAL_SERVICE_TOKEN
    )
    .send({
      id: userId,
      username,
      displayName: "Internal User",
      bio: "Created by internal service"
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);

  assert.equal(
    response.body.data.user.id,
    userId
  );

  await prisma.userPreferences.deleteMany({
    where: {
      userId
    }
  });

  await prisma.userStats.deleteMany({
    where: {
      userId
    }
  });

  await prisma.user.delete({
    where: {
      id: userId
    }
  });
});


test("internal rating update works", async () => {
  const response = await request(app)
    .patch(`/api/v1/users/internal/users/${TEST_USER_ID}/rating`)
    .set(
      "X-Internal-Service-Token",
      env.INTERNAL_SERVICE_TOKEN
    )
    .send({
      rating: 1500
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.rating, 1500);
});


test("internal rating update rejects invalid rating", async () => {
  const response = await request(app)
    .patch(`/api/v1/users/internal/users/${TEST_USER_ID}/rating`)
    .set(
      "X-Internal-Service-Token",
      env.INTERNAL_SERVICE_TOKEN
    )
    .send({
      rating: 6000
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});


test("internal statistics update works", async () => {
  const response = await request(app)
    .patch(`/api/v1/users/internal/users/${TEST_USER_ID}/stats`)
    .set(
      "X-Internal-Service-Token",
      env.INTERNAL_SERVICE_TOKEN
    )
    .send({
      problemsSolved: 10,
      problemsAttempted: 15,
      submissions: 20,
      acceptedSubmissions: 12
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const stats = response.body.data.stats;

  assert.equal(stats.problemsSolved, 10);
  assert.equal(stats.problemsAttempted, 15);
  assert.equal(stats.submissions, 20);
  assert.equal(stats.acceptedSubmissions, 12);
});


/*
|--------------------------------------------------------------------------
| Unknown Routes
|--------------------------------------------------------------------------
*/

test("unknown routes return 404", async () => {
  const response = await request(app)
    .get("/api/v1/does-not-exist");

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "ROUTE_NOT_FOUND");
});