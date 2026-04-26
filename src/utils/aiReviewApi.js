import { apiClient } from "./apiClient";

export const fetchAIReviewQueue = async ({ status = "pending", limit = 10 } = {}) => {
  const response = await apiClient.get("/ai/review-queue", {
    params: { status, limit },
  });
  return {
    entries: response?.data?.entries || [],
    pendingCount: response?.data?.pendingCount || 0,
  };
};

export const reviewAIAssessment = async ({ id, decision, reviewNote = "" }) => {
  const response = await apiClient.patch(`/ai/review-queue/${id}/review`, {
    decision,
    reviewNote,
  });
  return response?.data?.assessment || null;
};
