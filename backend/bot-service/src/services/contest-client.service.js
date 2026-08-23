const { env } = require("../config/env");
const { requestJson } = require("./http.service");
const AppError = require("../utils/app-error");

async function getContest(contestId) {
  const body = await requestJson(`${env.CONTEST_SERVICE_URL}/api/v1/contests/${contestId}`);
  const contest = body?.data?.contest;
  if (!contest) throw new AppError(502, "Contest Service returned no contest", "INVALID_CONTEST_RESPONSE");
  return contest;
}

async function recordBotSubmission(contestId, submission) {
  const body = await requestJson(
    `${env.CONTEST_SERVICE_URL}/api/v1/contests/internal/${contestId}/bot-submissions`,
    {
      method: "POST",
      headers: {
        "x-internal-service-token": env.INTERNAL_SERVICE_TOKEN
      },
      body: JSON.stringify(submission)
    }
  );

  const result = body?.data?.submission;
  if (!result) throw new AppError(502, "Contest Service returned no bot submission", "INVALID_CONTEST_RESPONSE");
  return result;
}

module.exports = { getContest, recordBotSubmission };
