import mongoose from "mongoose";

const aiAssessmentSchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    imageUrl: { type: String, default: "" },
    aiSource: { type: String, default: "heuristic-fallback" },
    imagePrimary: { type: Boolean, default: false },

    predictedCategory: {
      type: String,
      enum: ["Road", "Water", "Streetlight", "Waste", "Traffic", "Safety", "Other"],
      default: "Other",
    },
    predictedSeverity: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Low" },
    finalSeverityScore: { type: Number, min: 0, max: 100, default: 0 },
    confidence: { type: Number, min: 0, max: 1, default: 0 },

    textImageConsistency: { type: Number, min: 0, max: 100, default: null },
    manipulationRisk: { type: Number, min: 0, max: 100, default: null },
    evidenceQuality: { type: Number, min: 0, max: 100, default: null },
    reliabilityClass: {
      type: String,
      enum: ["verified_likely", "needs_review", "likely_mismatch"],
      default: "needs_review",
      index: true,
    },
    rationale: { type: String, default: "" },

    selectedCategory: { type: String, default: null },
    selectedSeverity: { type: String, default: null },
    accepted: { type: Boolean, default: null },
    overridden: { type: Boolean, default: null },

    reviewStatus: {
      type: String,
      enum: ["pending", "not_required", "reviewed"],
      default: "pending",
      index: true,
    },
    reviewDecision: {
      type: String,
      enum: ["supports_claim", "mismatch", "inconclusive", null],
      default: null,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
    trustImpact: { type: Number, default: 0 },
  },
  { timestamps: true }
);

aiAssessmentSchema.index({ reviewStatus: 1, reliabilityClass: 1, createdAt: -1 });

export const AIAssessment = mongoose.model("AIAssessment", aiAssessmentSchema);
