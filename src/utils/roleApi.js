import { apiClient } from "./apiClient";

export async function isOfficial() {
  const response = await apiClient.get("/auth/me");
  const role = response?.data?.user?.role;
  return role === "official" || role === "admin";
}

export async function isAdmin() {
  const response = await apiClient.get("/auth/me");
  const role = response?.data?.user?.role;
  return role === "admin";
}
