import { apiClient } from "./apiClient";
import { Statuses } from "./enums";

function normalizeWorkflowStatus(status) {
  return String(status || "Open").trim().toLowerCase();
}

function mapBackendStatusToLegacy(status, citizenRating) {
  const normalized = normalizeWorkflowStatus(status);

  if (normalized === "rejected") return Statuses.rejected;
  if (normalized === "closed") return Statuses.solved;
  if (normalized === "resolved") return citizenRating ? Statuses.solved : Statuses.pending_rating;
  return Statuses.inProgress;
}

function mapComplaintToLegacy(complaint) {
  const createdAt = complaint.createdAt ? new Date(complaint.createdAt).getTime() : Date.now();
  const lng = complaint?.location?.coordinates?.[0] ?? 0;
  const lat = complaint?.location?.coordinates?.[1] ?? 0;

  return {
    id: complaint._id,
    reason: complaint.title,
    additionalInfo: complaint.description,
    severity: complaint.severity,
    department: complaint.department,
    zone: complaint.zone,
    slaHours: complaint.slaHours,
    dueAt: complaint.dueAt,
    escalated: complaint.escalated,
    assignedOfficerId: complaint?.assignedTo?._id || null,
    assignedOfficerName: complaint?.assignedTo?.name || null,
    workflowStatus: complaint.status,
    category: complaint.category,
    aiSuggestion: complaint.aiSuggestion || null,
    location: {
      name: complaint?.location?.address || "Unknown",
      lat,
      lng,
    },
    mediaPath: complaint?.mediaUrls?.[0] || "",
    mediaType: "image",
    status: mapBackendStatusToLegacy(complaint.status, complaint.citizenRating),
    timestamp: createdAt,
    reportedBy: complaint?.createdBy?._id || complaint?.createdBy,
    author: complaint?.createdBy?.name || "Unknown",
    resolvedAt: complaint.resolvedAt || null,
    resolvedByName: complaint?.resolvedBy?.name || null,
    resolutionNote: complaint.resolutionNote || null,
    rejectedAt: complaint.rejectedAt || null,
    rejectedByName: complaint?.rejectedBy?.name || null,
    rejectionNote: complaint.rejectionNote || null,
    comments: (complaint.comments || []).map((comment) => ({
      id: comment._id,
      author: comment.authorId,
      authorName: comment.authorName,
      comment: comment.comment,
      timestamp: comment.timestamp,
    })),
    resolutionImageUrl: complaint.resolutionProofUrl || null,
    userRating: complaint.citizenRating || null,
  };
}

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

export const createComplaint = async (formData) => {
  await apiClient.post("/complaints", {
    title: formData.reason,
    description: formData.additionalInfo,
    category: formData.category || "Other",
    severity: formData.severity || "Low",
    location: {
      coordinates: [Number(formData.location.lng), Number(formData.location.lat)],
      address: formData.location.name || "",
    },
    mediaUrls: formData.mediaPath ? [formData.mediaPath] : [],
    aiSuggestion: formData.aiSuggestion || undefined,
  });
};

export const fetchComplaintTaxonomy = async () => {
  const response = await apiClient.get("/complaints/taxonomy");
  return response?.data?.taxonomy || [];
};

export const classifyComplaintAI = async ({ title, description, imageData, imageMimeType, imageUrl }) => {
  const payload = {
    title,
    description,
    imageData,
    imageMimeType,
    imageUrl,
  };

  const buildLocalFallback = () => {
    const text = `${title || ""} ${description || ""}`.toLowerCase();
    let category = "Other";

    if (/pothole|road crack|broken road|pavement|crater/.test(text)) category = "Road";
    else if (/water|logging|drain|leak|sewage|flood/.test(text)) category = "Water";
    else if (/street ?light|dark area|no light|lamp post/.test(text)) category = "Streetlight";
    else if (/garbage|waste|trash|dump|dirty/.test(text)) category = "Waste";
    else if (/traffic|racing|speed|overtake|jam/.test(text)) category = "Traffic";
    else if (/helmet|seat ?belt|unsafe|hazard|dangerous crossing/.test(text)) category = "Safety";

    const severity = /accident|injury|fire|critical|life threat/.test(text)
      ? "Critical"
      : /urgent|immediate|major|severe|danger|huge|deep|overflow/.test(text)
      ? "High"
      : ["Water", "Streetlight", "Waste", "Traffic"].includes(category)
      ? "Medium"
      : "Low";

    const score = severity === "Critical" ? 90 : severity === "High" ? 74 : severity === "Medium" ? 52 : 22;

    return {
      category,
      reasonLabel: category,
      severity,
      confidence: 0.55,
      finalSeverityScore: score,
      textImageConsistency: null,
      manipulationRisk: null,
      evidenceQuality: null,
      reliabilityClass: "needs_review",
      imagePrimary: false,
      aiSource: "frontend-fallback",
      rationale: "AI service temporarily unavailable. Applied text-based fallback.",
    };
  };

  try {
    const response = await apiClient.post("/ai/classify-complaint", payload);
    return response?.data?.suggestion;
  } catch (error) {
    const imageFallbackReason =
      (error?.response?.status === 413
        ? "Image payload too large for AI endpoint"
        : error?.response?.data?.message || error?.message || "Image analysis request failed");

    const hasImagePayload = Boolean(imageData || imageUrl);

    if (hasImagePayload) {
      try {
        const retryResponse = await apiClient.post("/ai/classify-complaint", {
          title,
          description,
        });
        const retrySuggestion = retryResponse?.data?.suggestion || null;
        if (!retrySuggestion) {
          return buildLocalFallback();
        }

        return {
          ...retrySuggestion,
          imageFallbackReason,
        };
      } catch (_retryError) {
        return {
          ...buildLocalFallback(),
          imageFallbackReason,
        };
      }
    }

    return buildLocalFallback();
  }
};

export const fetchComplaintsByUser = (uid, handleComplaintsUpdate) => {
  return createPollingFetcher(async () => {
    const response = await apiClient.get("/complaints/mine");
    return (response.data.complaints || []).map(mapComplaintToLegacy);
  }, handleComplaintsUpdate);
};

export const fetchComplaints = (handleComplaintsUpdate, filters = {}) => {
  return createPollingFetcher(async () => {
    const response = await apiClient.get("/complaints", {
      params: {
        status: filters.status || undefined,
        department: filters.department || undefined,
        zone: filters.zone || undefined,
        escalated: filters.escalated || undefined,
      },
    });
    return (response.data.complaints || []).map(mapComplaintToLegacy);
  }, handleComplaintsUpdate);
};

export const fetchComplaintEvents = async (complaintID) => {
  const response = await apiClient.get(`/complaints/${complaintID}/events`);
  return (response.data.events || []).map((event) => ({
    id: event._id,
    eventType: event.eventType,
    note: event.note || "",
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    createdAt: event.createdAt,
    actorName: event?.actorId?.name || "System",
    actorRole: event?.actorId?.role || "",
  }));
};

export const fetchComplaintAnalyticsSummary = async () => {
  const response = await apiClient.get("/complaints/analytics/summary");
  return {
    summary: response?.data?.summary || null,
    departmentPerformance: response?.data?.departmentPerformance || [],
  };
};

export const addComment = async (complaintID, comment) => {
  await apiClient.post(`/complaints/${complaintID}/comments`, { comment });
};

export const markAsSolved = async (complaintID) => {
  await apiClient.patch(`/complaints/${complaintID}/status`, {
    status: "Resolved",
    note: "Marked as solved",
  });
};

export const markAsRejected = async (complaintID, note = "Marked as rejected") => {
  await apiClient.patch(`/complaints/${complaintID}/status`, {
    status: "Rejected",
    note,
  });
};

export const submitResolution = async (complaintID, resolutionImageUrl) => {
  await apiClient.patch(`/complaints/${complaintID}/status`, {
    status: "Resolved",
    resolutionProofUrl: resolutionImageUrl,
    note: "Resolved with proof",
  });
};

export const submitRating = async (complaintID, rating) => {
  await apiClient.post(`/complaints/${complaintID}/rating`, { rating });
};

export const assignComplaintToMe = async (complaintID) => {
  await apiClient.patch(`/complaints/${complaintID}/assign-me`);
};

export const startComplaintWork = async (complaintID) => {
  await apiClient.patch(`/complaints/${complaintID}/start`);
};

export const reassignComplaint = async (complaintID, assignedTo, note = "") => {
  await apiClient.patch(`/complaints/${complaintID}/reassign`, {
    assignedTo,
    note,
  });
};
