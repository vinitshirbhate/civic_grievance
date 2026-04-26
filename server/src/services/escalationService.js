import { Complaint } from "../models/Complaint.js";

export async function runEscalationSweep() {
  const now = new Date();

  const result = await Complaint.updateMany(
    {
      escalated: false,
      dueAt: { $lt: now },
      status: { $in: ["Open", "Assigned", "InProgress"] },
    },
    {
      $set: {
        escalated: true,
        escalatedAt: now,
      },
    }
  );

  return {
    matchedCount: result.matchedCount || 0,
    modifiedCount: result.modifiedCount || 0,
  };
}
