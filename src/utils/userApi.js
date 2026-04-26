import { auth } from "./Firebase";
import { apiClient } from "./apiClient";

function createPollingFetcher(fetcher, handler, intervalMs = 10000) {
  let active = true;

  const run = async () => {
    if (!active) return;
    try {
      const result = await fetcher();
      handler(result);
    } catch (error) {
      console.error(error);
    }
  };

  run();
  const handle = setInterval(run, intervalMs);

  return () => {
    active = false;
    clearInterval(handle);
  };
}

export const getUserProfile = (userId, handleProfileUpdate) => {
  if (!userId) {
    if (typeof handleProfileUpdate === "function") {
      handleProfileUpdate(null);
    }
    return () => {};
  }

  return createPollingFetcher(async () => {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data.user;
  }, handleProfileUpdate);
};

export const fetchUserById = async (uid) => {
  if (!uid) {
    return { name: "Unknown" };
  }

  if (auth.currentUser?.uid === uid) {
    return { name: auth.currentUser.displayName };
  }

  const response = await apiClient.get(`/users/${uid}`);
  return { name: response.data.user.name };
};

export const listOfficials = async () => {
  const response = await apiClient.get("/users", {
    params: { role: "official" },
  });
  return response.data.users || [];
};

export const fetchLeaderboard = async (limit = 5) => {
  const response = await apiClient.get("/users/leaderboard", {
    params: { limit },
  });
  return response.data.users || [];
};

export const fetchMyPointsLedger = async (limit = 8) => {
  const response = await apiClient.get("/users/me/points-ledger", {
    params: { limit },
  });
  return response.data.entries || [];
};

export const fetchMyGamificationSummary = async () => {
  const response = await apiClient.get("/users/me/gamification-summary");
  return response.data.summary || null;
};
