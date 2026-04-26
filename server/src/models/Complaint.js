import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    comment: { type: String, required: true, trim: true },
    timestamp: { type: Number, required: true },
  },
  { _id: true }
);

const complaintSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "Road",
        "Water",
        "Streetlight",
        "Waste",
        "Traffic",
        "Safety",
        "Other",
      ],
      default: "Other",
    },
    severity: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Low" },
    department: {
      type: String,
      enum: ["Roads", "Water", "Electrical", "Sanitation", "Traffic", "Safety", "General"],
      default: "General",
    },
    zone: { type: String, default: "Central" },
    slaHours: { type: Number, default: 48 },
    dueAt: { type: Date, required: true },
    escalated: { type: Boolean, default: false },
    escalatedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["Open", "Assigned", "InProgress", "Resolved", "Rejected", "Closed"],
      default: "Open",
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
      address: { type: String, default: "" },
    },
    mediaUrls: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    aiSuggestion: {
      category: { type: String, default: null },
      severity: { type: String, default: null },
      confidence: { type: Number, default: null },
      finalSeverityScore: { type: Number, default: null },
      reliabilityClass: {
        type: String,
        enum: ["verified_likely", "needs_review", "likely_mismatch", null],
        default: null,
      },
      textImageConsistency: { type: Number, default: null },
      manipulationRisk: { type: Number, default: null },
      evidenceQuality: { type: Number, default: null },
      imagePrimary: { type: Boolean, default: null },
      aiSource: { type: String, default: null },
      rationale: { type: String, default: null },
      accepted: { type: Boolean, default: null },
      overridden: { type: Boolean, default: null },
      selectedCategory: { type: String, default: null },
      selectedSeverity: { type: String, default: null },
      reviewed: { type: Boolean, default: false },
      reviewDecision: {
        type: String,
        enum: ["supports_claim", "mismatch", "inconclusive", null],
        default: null,
      },
      reviewNote: { type: String, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    upvotes: { type: Number, default: 0 },
    citizenRating: { type: Number, min: 1, max: 5, default: null },
    resolutionProofUrl: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolutionNote: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionNote: { type: String, default: null },
    comments: [commentSchema],
  },
  { timestamps: true }
);

complaintSchema.index({ location: "2dsphere" });
complaintSchema.index({ status: 1, category: 1, severity: 1 });
complaintSchema.index({ dueAt: 1, escalated: 1, status: 1 });

export const Complaint = mongoose.model("Complaint", complaintSchema);
