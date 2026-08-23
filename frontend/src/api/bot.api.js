import api from "./client";

export async function listBots() {
  const response = await api.get(
    "/api/v1/bots"
  );

  return response.data.data.bots;
}

export async function getBot(id) {
  const response = await api.get(
    `/api/v1/bots/${id}`
  );

  return response.data.data.bot;
}
