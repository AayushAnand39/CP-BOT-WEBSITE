import api from "./client";

export async function createChallenge(payload) {
  const response = await api.post("/api/v1/contests/challenges", payload);
  return response.data.data;
}
export async function getChallenge(id) {
  const response = await api.get(`/api/v1/contests/challenges/${id}`);
  return response.data.data.challenge;
}
export async function getChallengeHistory() {
  const response = await api.get("/api/v1/contests/challenges");
  return response.data.data.challenges;
}
export async function getContest(id) {
  const response = await api.get(`/api/v1/contests/${id}`);
  return response.data.data.contest;
}
export async function getContestProblem(contestId, problemId) {
  const response = await api.get(
    `/api/v1/contests/${contestId}/problems/${problemId}`,
  );
  return response.data.data.problem;
}
export async function getStandings(id) {
  const response = await api.get(`/api/v1/contests/${id}/standings`);
  return response.data.data.standings;
}
export async function getContestActivity(id) {
  const response = await api.get(`/api/v1/contests/${id}/activity`);
  return response.data.data.activity;
}
export async function runSamples(contestId, payload) {
  const response = await api.post(
    `/api/v1/contests/${contestId}/run-samples`,
    payload,
  );
  return response.data.data.result;
}

export async function runCode(contestId, payload) {
  const response = await api.post(`/api/v1/contests/${contestId}/run`, payload);
  return response.data.data.result;
}
export async function getSubmission(contestId, submissionId) {
  const response = await api.get(
    `/api/v1/contests/${contestId}/submissions/${submissionId}`,
  );
  return response.data.data.submission;
}

export async function submitCode(contestId, payload) {
  const response = await api.post(
    `/api/v1/contests/${contestId}/submissions`,
    payload,
    { timeout: 600000 },
  );
  return response.data.data.submission;
}
export async function finishContest(contestId) {
  const response = await api.post(
    `/api/v1/contests/${contestId}/finish`,
    undefined,
    { timeout: 300000 },
  );
  return response.data.data;
}
