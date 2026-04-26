import { User } from "../models/User.js";
import { PointsLedger } from "../models/PointsLedger.js";
import mongoose from "mongoose";
import { rankRules } from "../utils/gamification.js";
import { ApiError, asyncHandler } from "../utils/apiError.js";

function dayKey(value) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}

function computeActiveStreak(entries) {
  if (!entries?.length) return 0;

  const keys = new Set(entries.map((entry) => dayKey(entry.createdAt)));
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  let streak = 0;
  while (true) {
    const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth() + 1}-${cursor.getUTCDate()}`;
    if (!keys.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function buildLastDaysTrend(entries, days = 7) {
  const now = new Date();
  const buckets = [];
  const map = new Map();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    const key = dayKey(d);
    buckets.push({ key, label: d.toLocaleDateString("en-IN", { weekday: "short" }), points: 0 });
    map.set(key, buckets[buckets.length - 1]);
  }

  entries.forEach((entry) => {
    const key = dayKey(entry.createdAt);
    const bucket = map.get(key);
    if (bucket) {
      bucket.points += Number(entry.points || 0);
    }
  });

  return buckets;
}

export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid user id");
  }

  const user = await User.findById(id).select("_id name email role points rank trustScore");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({ user });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { role } = req.query;
  const query = {};

  if (role) {
    query.role = role;
  }

  const users = await User.find(query)
    .select("_id name email role")
    .sort({ name: 1 });

  res.status(200).json({ users });
});

export const getLeaderboard = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const sanitizedLimit = Math.min(Number(limit) || 10, 50);

  const users = await User.find({ role: "citizen" })
    .select("_id name points rank")
    .sort({ points: -1, createdAt: 1 })
    .limit(sanitizedLimit);

  res.status(200).json({ users });
});

export const getMyPointsLedger = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;
  const sanitizedLimit = Math.min(Number(limit) || 20, 100);

  const entries = await PointsLedger.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(sanitizedLimit)
    .select("_id action points note complaintId createdAt");

  res.status(200).json({ entries });
});

export const getMyGamificationSummary = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("_id name points rank trustScore");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const now = new Date();
  const start7 = new Date(now);
  start7.setUTCDate(start7.getUTCDate() - 6);
  start7.setUTCHours(0, 0, 0, 0);

  const start30 = new Date(now);
  start30.setUTCDate(start30.getUTCDate() - 29);
  start30.setUTCHours(0, 0, 0, 0);

  const [recentEntries, weeklyAgg, monthlyAgg, actionAgg] = await Promise.all([
    PointsLedger.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(120)
      .select("createdAt points action"),
    PointsLedger.aggregate([
      { $match: { userId: user._id, createdAt: { $gte: start7 } } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]),
    PointsLedger.aggregate([
      { $match: { userId: user._id, createdAt: { $gte: start30 } } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]),
    PointsLedger.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: "$action", count: { $sum: 1 } } },
    ]),
  ]);

  const weeklyPoints = Number(weeklyAgg?.[0]?.total || 0);
  const monthlyPoints = Number(monthlyAgg?.[0]?.total || 0);
  const activeStreakDays = computeActiveStreak(recentEntries);

  const sortedRanks = [...rankRules].sort((a, b) => a.minPoints - b.minPoints);
  const currentRankIndex = Math.max(
    0,
    sortedRanks.findIndex((rule, index) => {
      const next = sortedRanks[index + 1];
      return user.points >= rule.minPoints && (!next || user.points < next.minPoints);
    })
  );
  const currentRank = sortedRanks[currentRankIndex] || sortedRanks[0];
  const nextRank = sortedRanks[currentRankIndex + 1] || null;

  const pointsSinceCurrentRank = user.points - currentRank.minPoints;
  const pointsToNextRank = nextRank ? Math.max(0, nextRank.minPoints - user.points) : 0;
  const pointsBand = nextRank ? nextRank.minPoints - currentRank.minPoints : 1;
  const progressToNextRankPct = nextRank ? Math.min(100, Math.round((pointsSinceCurrentRank / pointsBand) * 100)) : 100;

  const countByAction = actionAgg.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  const badges = [
    {
      key: "first-report",
      title: "First Reporter",
      unlocked: (countByAction.COMPLAINT_REPORTED || 0) >= 1,
      hint: "Submit 1 complaint",
    },
    {
      key: "consistent-voice",
      title: "Consistent Voice",
      unlocked: activeStreakDays >= 3,
      hint: "Stay active for 3 consecutive days",
    },
    {
      key: "community-helper",
      title: "Community Helper",
      unlocked: (countByAction.COMMENT_ADDED || 0) >= 12,
      hint: "Add 12 meaningful comments",
    },
    {
      key: "feedback-ally",
      title: "Feedback Ally",
      unlocked: (countByAction.RATING_SUBMITTED || 0) >= 5,
      hint: "Submit 5 resolution ratings",
    },
    {
      key: "city-sentinel",
      title: "City Sentinel",
      unlocked: user.points >= 700,
      hint: "Reach 700 total points",
    },
  ];

  const trend = buildLastDaysTrend(recentEntries, 7);

  res.status(200).json({
    summary: {
      totalPoints: user.points,
      rank: user.rank,
      trustScore: user.trustScore,
      weeklyPoints,
      monthlyPoints,
      activeStreakDays,
      pointsToNextRank,
      progressToNextRankPct,
      currentRankMinPoints: currentRank.minPoints,
      nextRank: nextRank ? { name: nextRank.rank, minPoints: nextRank.minPoints } : null,
      badges,
      trend,
      actionCount: {
        complaints: countByAction.COMPLAINT_REPORTED || 0,
        comments: countByAction.COMMENT_ADDED || 0,
        ratings: countByAction.RATING_SUBMITTED || 0,
      },
    },
  });
});
