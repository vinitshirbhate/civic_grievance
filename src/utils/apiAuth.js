import { apiClient, setAuthToken } from "./apiClient";
import { setAuthenticatedUser } from "./Firebase";

export async function registerCitizen(payload) {
  const response = await apiClient.post("/auth/register", payload);
  if (response.data.token) {
    setAuthToken(response.data.token);
  }
  setAuthenticatedUser(response.data.user);
  return response.data;
}

export async function loginUser(payload) {
  const response = await apiClient.post("/auth/login", payload);
  if (response.data.token) {
    setAuthToken(response.data.token);
  }
  setAuthenticatedUser(response.data.user);
  return response.data;
}

export async function getCurrentUser() {
  const response = await apiClient.get("/auth/me");
  return response.data.user;
}
