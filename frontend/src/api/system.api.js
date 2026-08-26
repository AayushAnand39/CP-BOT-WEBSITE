import api from "./client";

export async function warmupBackend() {
  const response = await api.get("/api/v1/system/warmup", {
    timeout: 180000,
  });

  return response.data;
}
