import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["citizen", "official", "admin"], default: "citizen" },
    points: { type: Number, default: 0 },
    rank: { type: String, default: "Civic Starter" },
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

export const User = mongoose.model("User", userSchema);
