import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is missing in environment variables.");
  }

  await mongoose.connect(env.mongoUri);
  console.log("MongoDB connected");
}
