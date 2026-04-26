import { AIAssessment } from "../models/AIAssessment.js";
import { Complaint } from "../models/Complaint.js";
import { ComplaintEvent } from "../models/ComplaintEvent.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { ApiError, asyncHandler } from "../utils/apiError.js";

function clamp(value, min = 0, max = 100) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(max, Math.max(min, num));
}

function getTrustImpact(decision, reliabilityClass) {
  if (decision === "mismatch") {
    if (reliabilityClass === "likely_mismatch") return -10;
    if (reliabilityClass === "needs_review") return -7;
    return -5;
  }

  if (decision === "supports_claim") {
    if (reliabilityClass === "likely_mismatch") return 4;
    if (reliabilityClass === "needs_review") return 2;
    return 1;
  }

  return -1;
}

async function createNotification({ userId, complaintId, type, message }) {
  if (!userId || !message) return;

  await Notification.create({
    userId,
    complaintId,
    type: type || "GENERAL",
    message: String(message).trim(),
  });
}

export const getAIReviewQueue = asyncHandler(async (req, res) => {
  const { status = "pending", reliabilityClass, limit = 25 } = req.query;
  const normalizedLimit = Math.min(Number(limit) || 25, 100);

  const query = {};
  if (status) {
    query.reviewStatus = status;
  }
  if (reliabilityClass) {
    query.reliabilityClass = reliabilityClass;
  }

  const [entries, pendingCount] = await Promise.all([
    AIAssessment.find(query)
      .sort({ createdAt: -1 })
      .limit(normalizedLimit)
      .populate("reporterId", "name trustScore")
      .populate({
        path: "complaintId",
        select: "title description category severity status mediaUrls location createdAt",
      }),
    AIAssessment.countDocuments({ reviewStatus: "pending" }),
  ]);

  res.status(200).json({ entries, pendingCount });
});

export const reviewAIAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { decision, reviewNote = "", categoryOverride, severityOverride } = req.body || {};

  if (!["supports_claim", "mismatch", "inconclusive"].includes(decision)) {
    throw new ApiError(400, "decision must be one of supports_claim, mismatch, inconclusive");
  }

  const assessment = await AIAssessment.findById(id);
  if (!assessment) {
    throw new ApiError(404, "AI assessment not found");
  }

  if (assessment.reviewStatus === "reviewed") {
    throw new ApiError(409, "Assessment already reviewed");
  }

  assessment.reviewStatus = "reviewed";
  assessment.reviewDecision = decision;
  assessment.reviewNote = String(reviewNote || "").trim();
  assessment.reviewedBy = req.user.id;
  assessment.reviewedAt = new Date();

  const trustImpact = getTrustImpact(decision, assessment.reliabilityClass);
  assessment.trustImpact = trustImpact;
  await assessment.save();

  const [reporter, complaint] = await Promise.all([
    User.findById(assessment.reporterId),
    Complaint.findById(assessment.complaintId),
  ]);

  if (reporter) {
    reporter.trustScore = clamp((reporter.trustScore || 50) + trustImpact, 0, 100);
    await reporter.save();
  }

  if (complaint) {
    complaint.aiSuggestion = {
      ...(complaint.aiSuggestion || {}),
      reviewed: true,
      reviewDecision: decision,
      reviewNote: assessment.reviewNote,
      reviewedAt: assessment.reviewedAt,
      reviewedBy: req.user.id,
    };

    if (categoryOverride) {
      complaint.category = categoryOverride;
      complaint.department =
        {
          Road: "Roads",
          Water: "Water",
          Streetlight: "Electrical",
          Waste: "Sanitation",
          Traffic: "Traffic",
          Safety: "Safety",
          Other: "General",
        }[categoryOverride] || complaint.department;
    }

    if (severityOverride) {
      complaint.severity = severityOverride;
      const slaHours =
        {
          Low: 72,
          Medium: 48,
          High: 24,
          Critical: 8,
        }[severityOverride] || complaint.slaHours;
      complaint.slaHours = slaHours;
      complaint.dueAt = new Date(new Date(complaint.createdAt).getTime() + slaHours * 60 * 60 * 1000);
    }

    // If evidence is reviewed as mismatch, move complaint out of active workflow.
    if (decision === "mismatch") {
      complaint.status = "Rejected";
      complaint.escalated = false;
      complaint.escalatedAt = null;
      complaint.rejectedAt = new Date();
      complaint.rejectedBy = req.user.id;
      complaint.rejectionNote =
        assessment.reviewNote || "Rejected after AI evidence mismatch review";
      complaint.resolvedAt = null;
      complaint.resolvedBy = null;
      complaint.resolutionNote = null;
    }

    await complaint.save();

    await ComplaintEvent.create({
      complaintId: complaint._id,
      actorId: req.user.id,
      eventType: "AIFeedbackCaptured",
      toStatus: complaint.status,
      note: `AI review completed: ${decision} (trust impact ${trustImpact >= 0 ? "+" : ""}${trustImpact})${decision === "mismatch" ? " | Complaint marked Rejected" : ""}`,
    });

    let reviewMessage = "AI evidence review completed for your complaint.";
    if (decision === "mismatch") {
      reviewMessage = "AI evidence review marked your complaint as mismatch. The complaint has been set to Rejected.";
    } else if (decision === "supports_claim") {
      reviewMessage = "AI evidence review confirmed your complaint evidence.";
    } else if (decision === "inconclusive") {
      reviewMessage = "AI evidence review is inconclusive. Your complaint remains under manual process.";
    }

    await createNotification({
      userId: assessment.reporterId,
      complaintId: complaint._id,
      type: "AI_REVIEWED",
      message: reviewMessage,
    });

    if (decision === "mismatch" && complaint.assignedTo && complaint.assignedTo.toString() !== req.user.id) {
      await createNotification({
        userId: complaint.assignedTo,
        complaintId: complaint._id,
        type: "STATUS_UPDATED",
        message: "Assigned complaint was rejected after AI evidence mismatch review.",
      });
    }
  }

  res.status(200).json({ assessment });
});
