import { Notification } from "../models/Notification.js";
import { ApiError, asyncHandler } from "../utils/apiError.js";

export const listMyNotifications = asyncHandler(async (req, res) => {
  const { unreadOnly, limit = 20 } = req.query;

  const query = { userId: req.user.id };
  if (unreadOnly === "true") {
    query.readAt = null;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 100));

  const unreadCount = await Notification.countDocuments({
    userId: req.user.id,
    readAt: null,
  });

  res.status(200).json({ notifications, unreadCount });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findOne({ _id: id, userId: req.user.id });
  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }

  res.status(200).json({ notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user.id, readAt: null },
    { $set: { readAt: new Date() } }
  );

  res.status(200).json({ success: true });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await Notification.findOneAndDelete({ _id: id, userId: req.user.id });
  if (!deleted) {
    throw new ApiError(404, "Notification not found");
  }

  res.status(200).json({ success: true });
});

export const deleteReadNotifications = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({
    userId: req.user.id,
    readAt: { $ne: null },
  });

  res.status(200).json({
    success: true,
    deletedCount: result.deletedCount || 0,
  });
});
