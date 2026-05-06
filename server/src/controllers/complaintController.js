import { Complaint } from "../models/Complaint.js";
import { ComplaintEvent } from "../models/ComplaintEvent.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { AIAssessment } from "../models/AIAssessment.js";
import { COMPLAINT_TAXONOMY, normalizeCategoryInput } from "../config/complaintTaxonomy.js";
import { awardPoints } from "../utils/gamification.js";
import { sendSMS } from "../utils/twilio.js";
import { ApiError, asyncHandler } from "../utils/apiError.js";

const SLA_HOURS_BY_SEVERITY = {
  Low: 72,
  Medium: 48,
  High: 24,
  Critical: 8,
};

const DEPARTMENT_BY_CATEGORY = {
  Road: "Roads",
  Water: "Water",
  Streetlight: "Electrical",
  Waste: "Sanitation",
  Traffic: "Traffic",
  Safety: "Safety",
  Other: "General",
};

const PUNE_GEOFENCE = {
  minLat: 18.36,
  maxLat: 18.68,
  minLng: 73.68,
  maxLng: 74.02,
};

function isWithinPune(lat, lng) {
  return (
    lat >= PUNE_GEOFENCE.minLat &&
    lat <= PUNE_GEOFENCE.maxLat &&
    lng >= PUNE_GEOFENCE.minLng &&
    lng <= PUNE_GEOFENCE.maxLng
  );
}

function getSlaHours(severity = "Low") {
  return SLA_HOURS_BY_SEVERITY[severity] || SLA_HOURS_BY_SEVERITY.Low;
}

function getDepartment(category = "Other") {
  return DEPARTMENT_BY_CATEGORY[category] || DEPARTMENT_BY_CATEGORY.Other;
}

function normalizeCategory(inputCategory) {
  return normalizeCategoryInput(inputCategory);
}

function clamp(value, min = 0, max = 100) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(max, Math.max(min, num));
}

async function createNotification({ userId, complaintId, type, message }) {
  if (!userId || !message) return;

  await Notification.create({
    userId,
    complaintId,
    type: type || "GENERAL",
    message: String(message).trim(),
  });

  try {
    const user = await User.findById(userId);
    if (user && user.mobile) {
      const smsTypes = ["STATUS_UPDATED", "RATING_REQUEST", "COMPLAINT_ASSIGNED", "SLA_BREACHED"];
      if (smsTypes.includes(type || "GENERAL")) {
        await sendSMS(user.mobile, `Civic Grievance: ${message}`);
      }
    }
  } catch (err) {
    console.error("Error sending SMS notification:", err);
  }
}

export const getComplaintTaxonomy = asyncHandler(async (_req, res) => {
  res.status(200).json({ taxonomy: COMPLAINT_TAXONOMY });
});

function getZoneByCoordinates(lng, lat) {
  const centerLat = 18.5204;
  const centerLng = 73.8567;
  if (lat >= centerLat && lng >= centerLng) return "North-East";
  if (lat >= centerLat && lng < centerLng) return "North-West";
  if (lat < centerLat && lng >= centerLng) return "South-East";
  return "South-West";
}

async function applyEscalationUpdates(query = {}) {
  const now = new Date();
  const overdueComplaints = await Complaint.find(
    {
      ...query,
      escalated: false,
      dueAt: { $lt: now },
      status: { $in: ["Open", "Assigned", "InProgress"] },
    }
  ).select("_id createdBy assignedTo department zone");

  if (overdueComplaints.length === 0) {
    return;
  }

  const complaintIds = overdueComplaints.map((complaint) => complaint._id);

  await Complaint.updateMany(
    { _id: { $in: complaintIds } },
    {
      $set: {
        escalated: true,
        escalatedAt: now,
      },
    }
  );

  const escalationEvents = overdueComplaints.map((complaint) => ({
    complaintId: complaint._id,
    actorId: complaint.createdBy,
    eventType: "Escalated",
    note: "Complaint escalated due to SLA breach",
  }));

  if (escalationEvents.length > 0) {
    await ComplaintEvent.insertMany(escalationEvents);
  }

  const notifications = [];
  for (const complaint of overdueComplaints) {
    notifications.push({
      userId: complaint.createdBy,
      complaintId: complaint._id,
      type: "SLA_BREACHED",
      message: `Your complaint has been escalated due to SLA breach (${complaint.department} - ${complaint.zone}).`,
    });

    if (complaint.assignedTo && complaint.assignedTo.toString() !== complaint.createdBy.toString()) {
      notifications.push({
        userId: complaint.assignedTo,
        complaintId: complaint._id,
        type: "SLA_BREACHED",
        message: `Assigned complaint breached SLA and was escalated (${complaint.department} - ${complaint.zone}).`,
      });
    }
  }

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }
}

export const createComplaint = asyncHandler(async (req, res) => {
  const { title, description, category, severity, location, mediaUrls, aiSuggestion } = req.body;

  if (!title || !description || !location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    throw new ApiError(400, "title, description and valid location coordinates are required");
  }

  const finalSeverity = severity || "Low";
  const finalCategory = normalizeCategory(category);
  const lat = Number(location.coordinates[1]);
  const lng = Number(location.coordinates[0]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError(400, "Invalid latitude/longitude coordinates");
  }

  if (!isWithinPune(lat, lng)) {
    throw new ApiError(400, "Location outside Pune is currently not supported");
  }

  const slaHours = getSlaHours(finalSeverity);
  const dueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);
  const zone = getZoneByCoordinates(lng, lat);

  const complaint = await Complaint.create({
    title,
    description,
    category: finalCategory,
    severity: finalSeverity,
    department: getDepartment(finalCategory),
    zone,
    slaHours,
    dueAt,
    location: {
      type: "Point",
      coordinates: [lng, lat],
      address: location.address || "",
    },
    mediaUrls: mediaUrls || [],
    createdBy: req.user.id,
    aiSuggestion: {
      category: aiSuggestion?.category || finalCategory || null,
      severity: aiSuggestion?.severity || finalSeverity || null,
      confidence: typeof aiSuggestion?.confidence === "number" ? aiSuggestion.confidence : null,
      finalSeverityScore: typeof aiSuggestion?.finalSeverityScore === "number" ? aiSuggestion.finalSeverityScore : null,
      reliabilityClass: aiSuggestion?.reliabilityClass || null,
      textImageConsistency: typeof aiSuggestion?.textImageConsistency === "number" ? aiSuggestion.textImageConsistency : null,
      manipulationRisk: typeof aiSuggestion?.manipulationRisk === "number" ? aiSuggestion.manipulationRisk : null,
      evidenceQuality: typeof aiSuggestion?.evidenceQuality === "number" ? aiSuggestion.evidenceQuality : null,
      imagePrimary: typeof aiSuggestion?.imagePrimary === "boolean" ? aiSuggestion.imagePrimary : null,
      aiSource: aiSuggestion?.aiSource || null,
      rationale: aiSuggestion?.rationale || null,
      accepted: typeof aiSuggestion?.accepted === "boolean" ? aiSuggestion.accepted : null,
      overridden: typeof aiSuggestion?.overridden === "boolean" ? aiSuggestion.overridden : null,
      selectedCategory: aiSuggestion?.selectedCategory || finalCategory || null,
      selectedSeverity: aiSuggestion?.selectedSeverity || finalSeverity || null,
    },
  });

  await ComplaintEvent.create({
    complaintId: complaint._id,
    actorId: req.user.id,
    eventType: "Created",
    toStatus: complaint.status,
    note: "Complaint created by citizen",
  });

  if (typeof complaint?.aiSuggestion?.accepted === "boolean") {
    const aiDecision = complaint.aiSuggestion.accepted ? "accepted" : "overridden";
    await ComplaintEvent.create({
      complaintId: complaint._id,
      actorId: req.user.id,
      eventType: "AIFeedbackCaptured",
      toStatus: complaint.status,
      note: `AI suggestion ${aiDecision} (predicted: ${complaint.aiSuggestion.category || "n/a"}/${complaint.aiSuggestion.severity || "n/a"}, selected: ${complaint.aiSuggestion.selectedCategory || "n/a"}/${complaint.aiSuggestion.selectedSeverity || "n/a"}, confidence: ${complaint.aiSuggestion.confidence ?? "n/a"})`,
    });
  }

  const hasAiAssessment =
    complaint?.aiSuggestion?.aiSource ||
    complaint?.aiSuggestion?.reliabilityClass ||
    complaint?.aiSuggestion?.confidence !== null;

  if (hasAiAssessment) {
    const reliabilityClass = complaint.aiSuggestion.reliabilityClass || "needs_review";
    const reviewStatus = reliabilityClass === "verified_likely" ? "not_required" : "pending";

    await AIAssessment.create({
      complaintId: complaint._id,
      reporterId: req.user.id,
      imageUrl: complaint.mediaUrls?.[0] || "",
      aiSource: complaint.aiSuggestion.aiSource || "heuristic-fallback",
      imagePrimary: Boolean(complaint.aiSuggestion.imagePrimary),
      predictedCategory: complaint.aiSuggestion.category || complaint.category,
      predictedSeverity: complaint.aiSuggestion.severity || complaint.severity,
      finalSeverityScore: typeof complaint.aiSuggestion.finalSeverityScore === "number" ? complaint.aiSuggestion.finalSeverityScore : 0,
      confidence: typeof complaint.aiSuggestion.confidence === "number" ? complaint.aiSuggestion.confidence : 0,
      textImageConsistency: complaint.aiSuggestion.textImageConsistency,
      manipulationRisk: complaint.aiSuggestion.manipulationRisk,
      evidenceQuality: complaint.aiSuggestion.evidenceQuality,
      reliabilityClass,
      rationale: complaint.aiSuggestion.rationale || "",
      selectedCategory: complaint.aiSuggestion.selectedCategory,
      selectedSeverity: complaint.aiSuggestion.selectedSeverity,
      accepted: complaint.aiSuggestion.accepted,
      overridden: complaint.aiSuggestion.overridden,
      reviewStatus,
    });

    if (reliabilityClass !== "verified_likely") {
      const reporter = await User.findById(req.user.id).select("trustScore");
      if (reporter) {
        const earlyPenalty = reliabilityClass === "likely_mismatch" ? -2 : -1;
        reporter.trustScore = clamp((reporter.trustScore || 50) + earlyPenalty, 0, 100);
        await reporter.save();
      }
    }
  }

  await awardPoints({
    userId: req.user.id,
    action: "COMPLAINT_REPORTED",
    complaintId: complaint._id,
    context: {
      severity: finalSeverity,
      description,
      mediaUrls,
      aiAccepted: complaint.aiSuggestion?.accepted,
      aiConfidence: complaint.aiSuggestion?.confidence,
    },
  });

  res.status(201).json({ complaint });
});

export const listComplaints = asyncHandler(async (req, res) => {
  const {
    status,
    category,
    severity,
    department,
    zone,
    escalated,
    nearLng,
    nearLat,
    maxDistance = 3000,
  } = req.query;

  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  if (severity) query.severity = severity;
  if (department) query.department = department;
  if (zone) query.zone = zone;
  if (escalated === "true" || escalated === "false") {
    query.escalated = escalated === "true";
  }

  if (nearLng && nearLat) {
    query.location = {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [Number(nearLng), Number(nearLat)],
        },
        $maxDistance: Number(maxDistance),
      },
    };
  }

  await applyEscalationUpdates();

  const complaints = await Complaint.find(query)
    .sort({ createdAt: -1 })
    .populate("createdBy", "name role")
    .populate("assignedTo", "name role")
    .populate("resolvedBy", "name role")
    .populate("rejectedBy", "name role");

  res.status(200).json({ complaints });
});

export const listMyComplaints = asyncHandler(async (req, res) => {
  await applyEscalationUpdates({ createdBy: req.user.id });
  const complaints = await Complaint.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
  res.status(200).json({ complaints });
});

export const getComplaintEvents = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const complaint = await Complaint.findById(id).select("createdBy");
  if (!complaint) {
    throw new ApiError(404, "Complaint not found");
  }

  if (req.user.role === "citizen" && complaint.createdBy.toString() !== req.user.id) {
    throw new ApiError(403, "Not authorized to view this complaint timeline");
  }

  const events = await ComplaintEvent.find({ complaintId: id })
    .sort({ createdAt: -1 })
    .populate("actorId", "name role");

  res.status(200).json({ events });
});

export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note, resolutionProofUrl, assignedTo } = req.body;

  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new ApiError(404, "Complaint not found");
  }

  const previousStatus = complaint.status;
  const statusChanged = Boolean(status) && status !== previousStatus;

  if (status) complaint.status = status;
  if (resolutionProofUrl) complaint.resolutionProofUrl = resolutionProofUrl;
  if (assignedTo !== undefined) complaint.assignedTo = assignedTo || null;

  if (statusChanged && status === "Resolved") {
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = req.user.id;
    complaint.resolutionNote = note || complaint.resolutionNote || "Marked as solved by official";
    complaint.rejectedAt = null;
    complaint.rejectedBy = null;
    complaint.rejectionNote = null;
  }

  if (statusChanged && status === "Rejected") {
    complaint.rejectedAt = new Date();
    complaint.rejectedBy = req.user.id;
    complaint.rejectionNote = note || complaint.rejectionNote || "Marked as rejected by official";
    complaint.resolvedAt = null;
    complaint.resolvedBy = null;
    complaint.resolutionNote = null;
  }

  if (statusChanged && ["Open", "Assigned", "InProgress"].includes(status)) {
    complaint.resolvedAt = null;
    complaint.resolvedBy = null;
    complaint.resolutionNote = null;
    complaint.rejectedAt = null;
    complaint.rejectedBy = null;
    complaint.rejectionNote = null;
  }

  if (["Resolved", "Rejected", "Closed"].includes(complaint.status)) {
    complaint.escalated = false;
    complaint.escalatedAt = null;
  }

  await complaint.save();

  await ComplaintEvent.create({
    complaintId: complaint._id,
    actorId: req.user.id,
    eventType: "StatusChanged",
    fromStatus: previousStatus,
    toStatus: complaint.status,
    note: note || "Status updated by official",
  });

  const actorId = String(req.user.id);
  const creatorId = complaint.createdBy ? String(complaint.createdBy) : null;
  const assigneeId = complaint.assignedTo ? String(complaint.assignedTo) : null;

  if (creatorId && creatorId !== actorId && previousStatus !== complaint.status) {
    let citizenMessage = `Your complaint status changed from ${previousStatus} to ${complaint.status}.`;
    let citizenType = "STATUS_UPDATED";

    if (complaint.status === "Resolved") {
      citizenType = "RATING_REQUEST";
      citizenMessage = "Your complaint has been marked Resolved. Please review the resolution proof and submit your rating.";
    } else if (complaint.status === "Rejected") {
      citizenMessage = "Your complaint has been marked as Rejected after official review.";
    } else if (complaint.status === "Closed") {
      citizenMessage = "Your complaint has been marked Closed. Thank you for your feedback.";
    }

    await createNotification({
      userId: complaint.createdBy,
      complaintId: complaint._id,
      type: citizenType,
      message: citizenMessage,
    });
  }

  if (assignedTo !== undefined && assigneeId && assigneeId !== actorId) {
    await createNotification({
      userId: complaint.assignedTo,
      complaintId: complaint._id,
      type: "COMPLAINT_ASSIGNED",
      message: `A complaint has been assigned to you (${complaint.department} - ${complaint.zone}).`,
    });
  }

  res.status(200).json({ complaint });
});

export const assignComplaintToMe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const complaint = await Complaint.findById(id);
  const actorId = String(req.user.id);

  if (!complaint) {
    throw new ApiError(404, "Complaint not found");
  }

  if (complaint.assignedTo && complaint.assignedTo.toString() !== actorId) {
    throw new ApiError(409, "Complaint already assigned to another official");
  }

  if (complaint.assignedTo && complaint.assignedTo.toString() === actorId) {
    return res.status(200).json({ complaint });
  }

  const nextStatus = complaint.status === "Open" ? "Assigned" : complaint.status;
  const updatedComplaint = await Complaint.findOneAndUpdate(
    { _id: id, assignedTo: null },
    {
      $set: {
        assignedTo: req.user.id,
        status: nextStatus,
      },
    },
    { new: true }
  );

  if (!updatedComplaint) {
    throw new ApiError(409, "Complaint already assigned to another official");
  }

  await ComplaintEvent.create({
    complaintId: updatedComplaint._id,
    actorId: req.user.id,
    eventType: "Assigned",
    fromStatus: complaint.status,
    toStatus: updatedComplaint.status,
    note: "Complaint assigned to current official",
  });

  await createNotification({
    userId: updatedComplaint.createdBy,
    complaintId: updatedComplaint._id,
    type: "COMPLAINT_ASSIGNED",
    message: "Your complaint has been assigned to an official and is now being handled.",
  });

  res.status(200).json({ complaint: updatedComplaint });
});

export const markComplaintInProgress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const complaint = await Complaint.findById(id);

  if (!complaint) {
    throw new ApiError(404, "Complaint not found");
  }

  if (!complaint.assignedTo) {
    throw new ApiError(400, "Assign complaint before starting progress");
  }

  complaint.status = "InProgress";
  await complaint.save();

  await ComplaintEvent.create({
    complaintId: complaint._id,
    actorId: req.user.id,
    eventType: "StatusChanged",
    fromStatus: "Assigned",
    toStatus: "InProgress",
    note: "Work started by official",
  });

  await createNotification({
    userId: complaint.createdBy,
    complaintId: complaint._id,
    type: "STATUS_UPDATED",
    message: "Work has started on your complaint.",
  });

  res.status(200).json({ complaint });
});

export const reassignComplaint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { assignedTo, note } = req.body;

  if (!assignedTo) {
    throw new ApiError(400, "assignedTo is required");
  }

  const official = await User.findById(assignedTo).select("role");
  if (!official || !["official", "admin"].includes(official.role)) {
    throw new ApiError(400, "assignedTo must be an official/admin user");
  }

  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new ApiError(404, "Complaint not found");
  }

  complaint.assignedTo = assignedTo;
  if (complaint.status === "Open") {
    complaint.status = "Assigned";
  }
  await complaint.save();

  await ComplaintEvent.create({
    complaintId: complaint._id,
    actorId: req.user.id,
    eventType: "Assigned",
    fromStatus: complaint.status === "Assigned" ? "Open" : complaint.status,
    toStatus: complaint.status,
    note: note || "Complaint reassigned by admin",
  });

  if (assignedTo.toString() !== req.user.id) {
    await createNotification({
      userId: assignedTo,
      complaintId: complaint._id,
      type: "COMPLAINT_ASSIGNED",
      message: `A complaint has been reassigned to you (${complaint.department} - ${complaint.zone}).`,
    });
  }

  await createNotification({
    userId: complaint.createdBy,
    complaintId: complaint._id,
    type: "STATUS_UPDATED",
    message: "Your complaint assignment has been updated by an admin.",
  });

  res.status(200).json({ complaint });
});

export const addComplaintComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  if (!comment || !comment.trim()) {
    throw new ApiError(400, "comment is required");
  }

  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new ApiError(404, "Complaint not found");
  }

  const user = await User.findById(req.user.id).select("name");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  complaint.comments.push({
    authorId: req.user.id,
    authorName: user.name,
    comment: comment.trim(),
    timestamp: Date.now(),
  });
  await complaint.save();

  await awardPoints({
    userId: req.user.id,
    action: "COMMENT_ADDED",
    complaintId: complaint._id,
    context: { comment: comment.trim() },
  });

  await ComplaintEvent.create({
    complaintId: complaint._id,
    actorId: req.user.id,
    eventType: "CommentAdded",
    note: "Comment added",
  });

  res.status(201).json({ complaint });
});

export const submitCitizenRating = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "rating must be between 1 and 5");
  }

  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new ApiError(404, "Complaint not found");
  }

  if (complaint.createdBy.toString() !== req.user.id) {
    throw new ApiError(403, "Only complaint creator can rate");
  }

  if (complaint.citizenRating !== null && complaint.citizenRating !== undefined) {
    throw new ApiError(409, "Rating already submitted for this complaint");
  }

  complaint.citizenRating = Number(rating);
  complaint.status = "Closed";
  await complaint.save();

  await awardPoints({
    userId: req.user.id,
    action: "RATING_SUBMITTED",
    complaintId: complaint._id,
    context: { rating: Number(rating) },
  });

  await ComplaintEvent.create({
    complaintId: complaint._id,
    actorId: req.user.id,
    eventType: "Rated",
    note: `Citizen rating submitted: ${rating}`,
  });

  res.status(200).json({ complaint });
});

export const getHeatmap = asyncHandler(async (req, res) => {
  const points = await Complaint.find({}, { "location.coordinates": 1, severity: 1, category: 1, status: 1, createdAt: 1 });

  const data = points.map((item) => ({
    lng: item.location.coordinates[0],
    lat: item.location.coordinates[1],
    severity: item.severity,
    category: item.category,
    status: item.status,
    createdAt: item.createdAt,
  }));

  res.status(200).json({ points: data });
});

export const getAnalyticsSummary = asyncHandler(async (_req, res) => {
  await applyEscalationUpdates();

  const totalComplaints = await Complaint.countDocuments({});
  const openComplaints = await Complaint.countDocuments({ status: { $in: ["Open", "Assigned", "InProgress"] } });
  const resolvedComplaints = await Complaint.countDocuments({ status: { $in: ["Resolved", "Closed"] } });
  const rejectedComplaints = await Complaint.countDocuments({ status: "Rejected" });
  const escalatedComplaints = await Complaint.countDocuments({ escalated: true });

  const resolvedDocs = await Complaint.find(
    { status: { $in: ["Resolved", "Closed"] } },
    { createdAt: 1, updatedAt: 1 }
  );

  const avgResolutionHours = resolvedDocs.length
    ? Number(
        (
          resolvedDocs.reduce((sum, item) => {
            const hours = (new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
            return sum + Math.max(0, hours);
          }, 0) / resolvedDocs.length
        ).toFixed(1)
      )
    : 0;

  const departmentPerformance = await Complaint.aggregate([
    {
      $group: {
        _id: "$department",
        total: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 1, 0],
          },
        },
        pending: {
          $sum: {
            $cond: [{ $in: ["$status", ["Open", "Assigned", "InProgress"]] }, 1, 0],
          },
        },
        escalated: {
          $sum: {
            $cond: ["$escalated", 1, 0],
          },
        },
      },
    },
    { $sort: { total: -1 } },
  ]);

  res.status(200).json({
    summary: {
      totalComplaints,
      openComplaints,
      resolvedComplaints,
      rejectedComplaints,
      escalatedComplaints,
      avgResolutionHours,
      slaBreachRate: totalComplaints ? Number(((escalatedComplaints / totalComplaints) * 100).toFixed(1)) : 0,
    },
    departmentPerformance: departmentPerformance.map((row) => ({
      department: row._id || "General",
      total: row.total,
      resolved: row.resolved,
      pending: row.pending,
      escalated: row.escalated,
    })),
  });
});
