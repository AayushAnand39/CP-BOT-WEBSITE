const { env } = require("../config/env");
const { requestJson } = require("./http.service");

async function generateBotAttempt(payload) {
  const body = await requestJson(
    `${env.AI_SERVICE_URL}/api/v1/ai/internal/bot-attempt`,
    {
      method: "POST",
      headers: { "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN },
      body: JSON.stringify(payload)
    },
    env.BOT_AI_TIMEOUT_MS
  );
  return body?.data ?? body;
}

module.exports = { generateBotAttempt };
