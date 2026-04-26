import { Router } from "express";
import {
  deleteNotification,
  deleteReadNotifications,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.get("/mine", authenticate, authorize("citizen", "official", "admin"), listMyNotifications);
router.patch("/:id/read", authenticate, authorize("citizen", "official", "admin"), markNotificationRead);
router.patch("/read-all", authenticate, authorize("citizen", "official", "admin"), markAllNotificationsRead);
router.delete("/:id", authenticate, authorize("citizen", "official", "admin"), deleteNotification);
router.delete("/mine/read", authenticate, authorize("citizen", "official", "admin"), deleteReadNotifications);

export default router;
