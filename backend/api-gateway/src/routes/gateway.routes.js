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

const authProxy = createServiceProxy({
  target: env.AUTH_SERVICE_URL,
  serviceName: "Auth Service",
});

const userProxy = createServiceProxy({
  target: env.USER_SERVICE_URL,
  serviceName: "User Service",
});

const problemProxy = createServiceProxy({
  target: env.PROBLEM_SERVICE_URL,
  serviceName: "Problem Service",
});

const contestProxy = createServiceProxy({
  target: env.CONTEST_SERVICE_URL,
  serviceName: "Contest Service",
});

const botProxy = createServiceProxy({
  target: env.BOT_SERVICE_URL,
  serviceName: "Bot Service",
});

const adminMaintenanceProxy = createProxyMiddleware({
  target: env.AI_SERVICE_URL,
  changeOrigin: true,

  proxyTimeout: env.REQUEST_TIMEOUT_MS,
  timeout: env.REQUEST_TIMEOUT_MS,

  pathRewrite(path, req) {
    const base = `/api/v1/ai/admin/problems/maintenance/${req.params.problemId}`;

    if (path.endsWith("/rebuild-archive")) {
      return `${base}/rebuild-archive`;
    }

    if (path.endsWith("/regenerate-testcases")) {
      return `${base}/regenerate-testcases`;
    }

    return base;
  },

  on: {
    proxyReq(proxyReq, req) {
      proxyReq.setHeader(
        "x-admin-orchestration-token",
        env.ADMIN_ORCHESTRATION_TOKEN,
      );

      proxyReq.setHeader("x-admin-user-id", req.auth.userId);

      if (req.auth.email) {
        proxyReq.setHeader("x-admin-user-email", req.auth.email);
      }
    },
  },
});

// ---------- Auth Service ----------
// Auth Service owns credential verification. Register/login stay public.
// /me is protected at both the Gateway and Auth Service.
// /verify is deliberately passed through because Auth Service returns the
// canonical verification response for callers that want it.
route("use", "/auth", authLimiter, authProxy);

// ---------- User Service ----------
route("get", "/users/public/:username", userProxy);

route("use", "/users", requireAuth, userProxy);

function adminAiProxy(targetPath) {
  return createProxyMiddleware({
    target: env.AI_SERVICE_URL,
    changeOrigin: true,
    // proxyTimeout: env.REQUEST_TIMEOUT_MS,
    // timeout: env.REQUEST_TIMEOUT_MS,
    pathRewrite: () => targetPath,
    on: {
      proxyReq(proxyReq, req) {
        proxyReq.setHeader(
          "x-admin-orchestration-token",
          env.ADMIN_ORCHESTRATION_TOKEN,
        );
        proxyReq.setHeader("x-admin-user-id", req.auth.userId);
        if (req.auth.email)
          proxyReq.setHeader("x-admin-user-email", req.auth.email);
      },
    },
  });
}

route(
  "post",
  "/admin/problems/import",
  requireAuth,
  requireAdmin,
  adminAiProxy("/api/v1/ai/admin/problems/import"),
);
route(
  "post",
  "/admin/problems/manual/polish",
  requireAuth,
  requireAdmin,
  adminAiProxy("/api/v1/ai/admin/problems/manual/polish"),
);
route(
  "post",
  "/admin/problems/manual/generator",
  requireAuth,
  requireAdmin,
  adminAiProxy("/api/v1/ai/admin/problems/manual/generator"),
);
route(
  "post",
  "/admin/problems/manual/testcases",
  requireAuth,
  requireAdmin,
  adminAiProxy("/api/v1/ai/admin/problems/manual/testcases"),
);
route(
  "post",
  "/admin/problems/manual/submit",
  requireAuth,
  requireAdmin,
  adminAiProxy("/api/v1/ai/admin/problems/manual/submit"),
);
route(
  "get",
  "/admin/problems/maintenance/:problemId",
  requireAuth,
  requireAdmin,
  adminMaintenanceProxy,
);

route(
  "patch",
  "/admin/problems/maintenance/:problemId",
  requireAuth,
  requireAdmin,
  adminMaintenanceProxy,
);

route(
  "post",
  "/admin/problems/maintenance/:problemId/rebuild-archive",
  requireAuth,
  requireAdmin,
  adminMaintenanceProxy,
);

route(
  "post",
  "/admin/problems/maintenance/:problemId/regenerate-testcases",
  requireAuth,
  requireAdmin,
  adminMaintenanceProxy,
);

// ---------- Problem Service ----------
// Public catalogue is read-only through Gateway.
// No problem mutations are exposed here.
route("get", "/problems", problemProxy);

route("get", "/problems/:id", problemProxy);

// ---------- Contest Service ----------
// ---------- Bot Challenge Orchestration ----------
route("post", "/contests/challenges", requireAuth, contestProxy);

route("get", "/contests/challenges", requireAuth, contestProxy);

route("get", "/contests/challenges/:challengeId", requireAuth, contestProxy);

route("get", "/contests", contestProxy);

route("get", "/contests/:id", contestProxy);

route("get", "/contests/:id/problems/:problemId", requireAuth, contestProxy);

route("get", "/contests/:id/activity", requireAuth, contestProxy);

route("get", "/contests/:id/standings", contestProxy);

route("post", "/contests/:id/join", requireAuth, contestProxy);

route("post", "/contests/:id/run-samples", requireAuth, contestProxy);

route("post", "/contests/:id/run", requireAuth, contestProxy);

route(
  "get",
  "/contests/:id/submissions/:submissionId",
  requireAuth,
  contestProxy,
);

route("post", "/contests/:id/submissions", requireAuth, contestProxy);

route("post", "/contests/:id/finish", requireAuth, contestProxy);

// ---------- Bot Service ----------
// Browser may browse/select bots. Bot creation/simulation is internal.
route("get", "/bots", botProxy);

route("get", "/bots/:id", botProxy);

module.exports = router;
