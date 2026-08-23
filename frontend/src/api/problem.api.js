import api from "./client";

export async function getProblem(id) {
  const response = await api.get(`/api/v1/problems/${id}`);
  return response.data.data.problem;
}
