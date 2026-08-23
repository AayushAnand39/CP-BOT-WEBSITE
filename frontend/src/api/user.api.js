import api from "./client";

export async function getUserMe() {
  const response = await api.get(
    "/api/v1/users/me"
  );

  return response.data.data;
}

export async function getUserStats() {
  const response = await api.get(
    "/api/v1/users/me/stats"
  );

  return response.data.data.stats;
}
