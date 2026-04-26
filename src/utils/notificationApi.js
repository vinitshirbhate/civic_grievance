import { apiClient } from "./apiClient";

export const fetchMyNotifications = async ({ unreadOnly = false, limit = 20 } = {}) => {
  const response = await apiClient.get("/notifications/mine", {
    params: {
      unreadOnly: unreadOnly ? "true" : undefined,
      limit,
    },
  });
  return {
    notifications: response?.data?.notifications || [],
    unreadCount: response?.data?.unreadCount || 0,
  };
};

export const markNotificationRead = async (id) => {
  await apiClient.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async () => {
  await apiClient.patch("/notifications/read-all");
};

export const deleteNotification = async (id) => {
  await apiClient.delete(`/notifications/${id}`);
};

export const deleteReadNotifications = async () => {
  await apiClient.delete("/notifications/mine/read");
};
