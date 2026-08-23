import api from "./client";

export async function importCodeforcesProblem({ problemCode, testCount }) {
  const response = await api.post("/api/v1/admin/problems/import", {
    problemCode,
    testCount
  });
  return response.data.data;
}


export async function polishManualProblem(problem) {
  const response = await api.post(
    "/api/v1/admin/problems/manual/polish",
    problem
  );
  return response.data.data;
}

export async function generateManualProblemGenerator(problem) {
  const response = await api.post(
    "/api/v1/admin/problems/manual/generator",
    problem
  );
  return response.data.data;
}

export async function generateManualProblemTestcases({
  generatorCode,
  solutionCode,
  testCount
}) {
  const response = await api.post(
    "/api/v1/admin/problems/manual/testcases",
    { generatorCode, solutionCode, testCount }
  );
  return response.data.data;
}

export async function submitManualProblem(problem) {
  const response = await api.post(
    "/api/v1/admin/problems/manual/submit",
    problem
  );
  return response.data.data;
}


export async function listMaintenanceProblems() {
  const response = await api.get("/api/v1/problems", {
    params: { page: 1, pageSize: 100, status: "READY" }
  });
  return response.data.data;
}

export async function getMaintenanceProblem(problemId) {
  const response = await api.get(`/api/v1/admin/problems/maintenance/${problemId}`);
  return response.data.data;
}

export async function updateMaintenanceProblem(problemId, content) {
  const response = await api.patch(`/api/v1/admin/problems/maintenance/${problemId}`, content);
  return response.data.data;
}

export async function regenerateMaintenanceTestcases(problemId, testCount = 10) {
  const response = await api.post(
    `/api/v1/admin/problems/maintenance/${problemId}/regenerate-testcases`,
    { testCount },
    { timeout: 300000 }
  );
  return response.data.data;
}


export async function rebuildMaintenanceArchive(problemId) {
  const response = await api.post(
    `/api/v1/admin/problems/maintenance/${problemId}/rebuild-archive`,
    {},
    { timeout: 120000 }
  );
  return response.data.data;
}
