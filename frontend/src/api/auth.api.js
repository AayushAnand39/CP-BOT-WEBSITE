import api from "./client";

export async function registerUser(payload) {
  const response = await api.post(
    "/api/v1/auth/register",
    payload
  );

  return response.data.data;
}

export async function loginUser(payload) {
  const response = await api.post(
    "/api/v1/auth/login",
    payload
  );

  return response.data.data;
}

export async function getAuthMe() {
  const response = await api.get(
    "/api/v1/auth/me"
  );

  return response.data.data.user;
}
