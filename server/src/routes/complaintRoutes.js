import { Router } from "express";
import {
  addComplaintComment,
  assignComplaintToMe,
  createComplaint,
  getAnalyticsSummary,
  getComplaintEvents,
  getComplaintTaxonomy,
  getHeatmap,
  listComplaints,
  listMyComplaints,
  markComplaintInProgress,
  reassignComplaint,
  submitCitizenRating,
  updateComplaintStatus,
} from "../controllers/complaintController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.get("/taxonomy", authenticate, authorize("citizen", "official", "admin"), getComplaintTaxonomy);
router.get("/analytics/summary", authenticate, authorize("official", "admin"), getAnalyticsSummary);
router.post("/", authenticate, authorize("citizen", "official", "admin"), createComplaint);
router.get("/", authenticate, authorize("citizen", "official", "admin"), listComplaints);
router.get("/mine", authenticate, authorize("citizen", "official", "admin"), listMyComplaints);
router.get("/:id/events", authenticate, authorize("citizen", "official", "admin"), getComplaintEvents);
router.get("/heatmap", authenticate, authorize("official", "admin"), getHeatmap);
router.patch("/:id/status", authenticate, authorize("official", "admin"), updateComplaintStatus);
router.patch("/:id/assign-me", authenticate, authorize("official", "admin"), assignComplaintToMe);
router.patch("/:id/start", authenticate, authorize("official", "admin"), markComplaintInProgress);
router.patch("/:id/reassign", authenticate, authorize("admin"), reassignComplaint);
router.post("/:id/comments", authenticate, authorize("citizen", "official", "admin"), addComplaintComment);
router.post("/:id/rating", authenticate, authorize("citizen", "official", "admin"), submitCitizenRating);

export default router;
