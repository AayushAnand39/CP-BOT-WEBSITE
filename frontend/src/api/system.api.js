import api from "./client";

const SERVICE_URLS = {
  gateway: import.meta.env.VITE_GATEWAY_URL,
  auth: import.meta.env.VITE_AUTH_SERVICE_URL,
  user: import.meta.env.VITE_USER_SERVICE_URL,
  problem: import.meta.env.VITE_PROBLEM_SERVICE_URL,
  contest: import.meta.env.VITE_CONTEST_SERVICE_URL,
  bot: import.meta.env.VITE_BOT_SERVICE_URL,
  ai: import.meta.env.VITE_AI_SERVICE_URL,
};

function normalizeUrl(url) {
  if (!url) {
    return null;
  }

  return url.replace(/\/+$/, "");
}

/**
 * Sends a request DIRECTLY from the browser to every service.
 *
 * We intentionally use `no-cors` because the purpose of this request
 * is only to make Render receive an inbound HTTP request and wake the
 * service. We do not need to inspect the response.
 */
async function wakeService(name, url) {
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    console.warn(`[WARMUP] URL not configured for ${name}`);

    return {
      name,
      requested: false,
      reason: "URL_NOT_CONFIGURED",
    };
  }

  try {
    await fetch(`${normalizedUrl}/health`, {
      method: "GET",

      // Allows us to send the wake request even when the service
      // itself does not expose CORS headers for the frontend.
      mode: "no-cors",

      // Do not allow the browser to satisfy this from cache.
      cache: "no-store",
    });

    console.log(`[WARMUP] Wake request sent to ${name}`);

    return {
      name,
      requested: true,
    };
  } catch (error) {
    console.warn(`[WARMUP] Failed to send wake request to ${name}`, error);

    return {
      name,
      requested: false,
      reason: error?.message || "REQUEST_FAILED",
    };
  }
}

/**
 * Wake every Render service directly from the user's browser.
 *
 * This is intentionally different from the Gateway readiness check.
 *
 * Browser
 *   -> Auth /health
 *   -> User /health
 *   -> Problem /health
 *   -> Contest /health
 *   -> Bot /health
 *   -> AI /health
 *
 * The requests run concurrently.
 */
export async function wakeBackendServices() {
  console.log("[FRONTEND WARMUP] Sending direct wake requests...");

  const results = await Promise.allSettled(
    Object.entries(SERVICE_URLS).map(([name, url]) => wakeService(name, url)),
  );

  return results;
}

/**
 * Ask Gateway to check which services are actually ready.
 *
 * The Gateway warmup endpoint should return HTTP 200 even when
 * some services are still starting:
 *
 * {
 *   success: true,
 *   ready: false,
 *   status: "WARMING",
 *   services: [...]
 * }
 */
export async function checkBackendServices() {
  const response = await api.get("/api/v1/system/warmup", {
    // Individual readiness checks should not hold the browser
    // forever.
    timeout: 45000,
  });

  return response.data;
}

/**
 * Kept for compatibility with any existing imports.
 */
export async function warmupBackend() {
  return checkBackendServices();
}
