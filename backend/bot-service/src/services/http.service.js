const { env } = require("../config/env");
const AppError = require("../utils/app-error");

async function requestJson(url, options = {}, timeoutMs = env.REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new AppError(502, `Invalid JSON response from ${url}`, "UPSTREAM_INVALID_RESPONSE");
    }

    if (!response.ok) {
      throw new AppError(
        response.status >= 500 ? 502 : response.status,
        body?.message || `Upstream request failed with ${response.status}`,
        body?.code || "UPSTREAM_REQUEST_FAILED",
        body?.details
      );
    }

    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AppError(504, `Upstream request timed out: ${url}`, "UPSTREAM_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { requestJson };
