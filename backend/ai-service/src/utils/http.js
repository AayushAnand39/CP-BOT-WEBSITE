const { env } = require("../config/env");
const AppError = require("./app-error");

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "CPBotPlatform/1.0 (+admin-triggered problem importer)",
        "accept-language": "en-US,en;q=0.9",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      throw new AppError(
        502,
        `Upstream returned HTTP ${response.status}`,
        "UPSTREAM_HTTP_ERROR",
        { url, status: response.status }
      );
    }

    return response.text();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.name === "AbortError") {
      throw new AppError(504, "Upstream request timed out", "UPSTREAM_TIMEOUT", { url });
    }
    throw new AppError(502, "Upstream request failed", "UPSTREAM_REQUEST_FAILED", {
      url,
      reason: error.message
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(502, "Upstream returned invalid JSON", "UPSTREAM_INVALID_JSON", { url });
  }
}

async function postJson(url, body, headers = {}, timeoutMs = env.REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
        ...headers
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch {}

    if (!response.ok) {
      throw new AppError(
        response.status >= 500 ? 502 : response.status,
        payload.message || `Request failed with HTTP ${response.status}`,
        payload.code || "UPSTREAM_SERVICE_ERROR",
        payload.details
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.name === "AbortError") {
      throw new AppError(504, "Service request timed out", "SERVICE_TIMEOUT", { url });
    }
    throw new AppError(502, "Service request failed", "SERVICE_REQUEST_FAILED", {
      url,
      reason: error.message
    });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchText, fetchJson, postJson };
