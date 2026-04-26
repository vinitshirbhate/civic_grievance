import mongoose from "mongoose";

const pointsLedgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", default: null },
    action: {
      type: String,
      enum: ["COMPLAINT_REPORTED", "COMMENT_ADDED", "RATING_SUBMITTED", "MANUAL_ADJUSTMENT"],
      required: true,
    },
    points: { type: Number, required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

pointsLedgerSchema.index({ userId: 1, createdAt: -1 });

export const PointsLedger = mongoose.model("PointsLedger", pointsLedgerSchema);
