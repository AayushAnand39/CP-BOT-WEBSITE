import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

const api = axios.create({
  baseURL: API_URL,
  timeout: 180000
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("cpbot_access_token");

  if (token) {
    config.headers.Authorization =
      `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(
        "cpbot_access_token"
      );
    }

    return Promise.reject(error);
  }
);

export default api;
