import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", default: null },
    type: {
      type: String,
      enum: [
        "SLA_BREACHED",
        "GENERAL",
        "COMPLAINT_ASSIGNED",
        "STATUS_UPDATED",
        "RATING_REQUEST",
        "AI_REVIEWED",
      ],
      default: "GENERAL",
    },
    message: { type: String, required: true, trim: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
