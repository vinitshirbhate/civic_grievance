import mongoose from "mongoose";

const complaintEventSchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eventType: {
      type: String,
      enum: [
        "Created",
        "Assigned",
        "StatusChanged",
        "CommentAdded",
        "Resolved",
        "Rejected",
        "Rated",
        "Escalated",
        "AIFeedbackCaptured",
      ],
      required: true,
    },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

complaintEventSchema.index({ complaintId: 1, createdAt: -1 });

export const ComplaintEvent = mongoose.model("ComplaintEvent", complaintEventSchema);
