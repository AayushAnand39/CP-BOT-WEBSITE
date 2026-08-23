const express = require("express");
const { env } = require("../config/env");
const { requireAuth } = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rate-limit.middleware");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { createServiceProxy } = require("../services/proxy.service");
const { requireAdmin } = require("../middleware/admin.middleware");

const router = express.Router();

function route(method, path, ...handlers) {
  router[method](path, ...handlers);
}

// ---------- Auth Service ----------
// Auth Service owns credential verification. Register/login stay public.
// /me is protected at both the Gateway and Auth Service.
// /verify is deliberately passed through because Auth Service returns the
// canonical verification response for callers that want it.
route(
  "use",
  "/auth",
  authLimiter,
  createServiceProxy({
    target: env.AUTH_SERVICE_URL,
    serviceName: "Auth Service"
  })
);

// ---------- User Service ----------
route(
  "get",
  "/users/public/:username",
  createServiceProxy({
    target: env.USER_SERVICE_URL,
    serviceName: "User Service"
  })
);

route(
  "use",
  "/users",
  requireAuth,
  createServiceProxy({
    target: env.USER_SERVICE_URL,
    serviceName: "User Service"
  })
);


function adminAiProxy(targetPath) {
  return createProxyMiddleware({
    target: env.AI_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: () => targetPath,
    on: {
      proxyReq(proxyReq, req) {
        proxyReq.setHeader("x-admin-orchestration-token", env.ADMIN_ORCHESTRATION_TOKEN);
        proxyReq.setHeader("x-admin-user-id", req.auth.userId);
        if (req.auth.email) proxyReq.setHeader("x-admin-user-email", req.auth.email);
      }
    }
  });
}

route("post", "/admin/problems/import", requireAuth, requireAdmin, adminAiProxy("/api/v1/ai/admin/problems/import"));
route("post", "/admin/problems/manual/polish", requireAuth, requireAdmin, adminAiProxy("/api/v1/ai/admin/problems/manual/polish"));
route("post", "/admin/problems/manual/generator", requireAuth, requireAdmin, adminAiProxy("/api/v1/ai/admin/problems/manual/generator"));
route("post", "/admin/problems/manual/testcases", requireAuth, requireAdmin, adminAiProxy("/api/v1/ai/admin/problems/manual/testcases"));
route("post", "/admin/problems/manual/submit", requireAuth, requireAdmin, adminAiProxy("/api/v1/ai/admin/problems/manual/submit"));
route("get", "/admin/problems/maintenance/:problemId", requireAuth, requireAdmin, (req, res, next) =>
  adminAiProxy(`/api/v1/ai/admin/problems/maintenance/${req.params.problemId}`)(req, res, next)
);
route("patch", "/admin/problems/maintenance/:problemId", requireAuth, requireAdmin, (req, res, next) =>
  adminAiProxy(`/api/v1/ai/admin/problems/maintenance/${req.params.problemId}`)(req, res, next)
);
route("post", "/admin/problems/maintenance/:problemId/rebuild-archive", requireAuth, requireAdmin, (req, res, next) =>
  adminAiProxy(`/api/v1/ai/admin/problems/maintenance/${req.params.problemId}/rebuild-archive`)(req, res, next)
);
route("post", "/admin/problems/maintenance/:problemId/regenerate-testcases", requireAuth, requireAdmin, (req, res, next) =>
  adminAiProxy(`/api/v1/ai/admin/problems/maintenance/${req.params.problemId}/regenerate-testcases`)(req, res, next)
);

// ---------- Problem Service ----------
// Public catalogue is read-only through Gateway.
// No problem mutations are exposed here.
route(
  "get",
  "/problems",
  createServiceProxy({
    target: env.PROBLEM_SERVICE_URL,
    serviceName: "Problem Service"
  })
);

route(
  "get",
  "/problems/:id",
  createServiceProxy({
    target: env.PROBLEM_SERVICE_URL,
    serviceName: "Problem Service"
  })
);

// ---------- Contest Service ----------
// ---------- Bot Challenge Orchestration ----------
route(
  "post",
  "/contests/challenges",
  requireAuth,
  createServiceProxy({
    target: env.CONTEST_SERVICE_URL,
    serviceName: "Contest Service"
  })
);

route(
  "get",
  "/contests/challenges",
  requireAuth,
  createServiceProxy({ target: env.CONTEST_SERVICE_URL, serviceName: "Contest Service" })
);

route(
  "get",
  "/contests/challenges/:challengeId",
  requireAuth,
  createServiceProxy({
    target: env.CONTEST_SERVICE_URL,
    serviceName: "Contest Service"
  })
);

route(
  "get",
  "/contests",
  createServiceProxy({
    target: env.CONTEST_SERVICE_URL,
    serviceName: "Contest Service"
  })
);

route(
  "get",
  "/contests/:id",
  createServiceProxy({
    target: env.CONTEST_SERVICE_URL,
    serviceName: "Contest Service"
  })
);

route(
  "get",
  "/contests/:id/problems/:problemId",
  requireAuth,
  createServiceProxy({ target: env.CONTEST_SERVICE_URL, serviceName: "Contest Service" })
);

route(
  "get",
  "/contests/:id/activity",
  requireAuth,
  createServiceProxy({ target: env.CONTEST_SERVICE_URL, serviceName: "Contest Service" })
);

route(
  "get",
  "/contests/:id/standings",
  createServiceProxy({
    target: env.CONTEST_SERVICE_URL,
    serviceName: "Contest Service"
  })
);

route(
  "post",
  "/contests/:id/join",
  requireAuth,
  createServiceProxy({
    target: env.CONTEST_SERVICE_URL,
    serviceName: "Contest Service"
  })
);

route(
  "post",
  "/contests/:id/run-samples",
  requireAuth,
  createServiceProxy({ target: env.CONTEST_SERVICE_URL, serviceName: "Contest Service" })
);

route(
  "post",
  "/contests/:id/run",
  requireAuth,
  createServiceProxy({ target: env.CONTEST_SERVICE_URL, serviceName: "Contest Service" })
);

route(
  "get",
  "/contests/:id/submissions/:submissionId",
  requireAuth,
  createServiceProxy({ target: env.CONTEST_SERVICE_URL, serviceName: "Contest Service" })
);

route(
  "post",
  "/contests/:id/submissions",
  requireAuth,
  createServiceProxy({
    target: env.CONTEST_SERVICE_URL,
    serviceName: "Contest Service"
  })
);

route(
  "post",
  "/contests/:id/finish",
  requireAuth,
  createServiceProxy({ target: env.CONTEST_SERVICE_URL, serviceName: "Contest Service" })
);

// ---------- Bot Service ----------
// Browser may browse/select bots. Bot creation/simulation is internal.
route(
  "get",
  "/bots",
  createServiceProxy({
    target: env.BOT_SERVICE_URL,
    serviceName: "Bot Service"
  })
);

route(
  "get",
  "/bots/:id",
  createServiceProxy({
    target: env.BOT_SERVICE_URL,
    serviceName: "Bot Service"
  })
);

module.exports = router;
