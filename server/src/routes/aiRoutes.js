import { Router } from "express";
import { classifyComplaint } from "../controllers/aiController.js";
import { getAIReviewQueue, reviewAIAssessment } from "../controllers/aiReviewController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.post(
  "/classify-complaint",
  authenticate,
  authorize("citizen", "official", "admin"),
  classifyComplaint
);

router.get(
  "/review-queue",
  authenticate,
  authorize("official", "admin"),
  getAIReviewQueue
);

router.patch(
  "/review-queue/:id/review",
  authenticate,
  authorize("official", "admin"),
  reviewAIAssessment
);

export default router;
