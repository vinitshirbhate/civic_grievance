import { PointsLedger } from "../models/PointsLedger.js";
import { User } from "../models/User.js";

export const rankRules = [
  { minPoints: 0, rank: "Civic Starter" },
  { minPoints: 60, rank: "Ward Watcher" },
  { minPoints: 150, rank: "Community Helper" },
  { minPoints: 280, rank: "Neighborhood Hero" },
  { minPoints: 450, rank: "City Champion" },
  { minPoints: 700, rank: "Urban Guardian" },
  { minPoints: 1000, rank: "Nagar Sentinel" },
];

const actionRulebook = {
  COMPLAINT_REPORTED: {
    base: 6,
    dailyLimit: 3,
    decayPerRepeat: 2,
    streakEligible: true,
  },
  COMMENT_ADDED: {
    base: 0,
    dailyLimit: 4,
    decayPerRepeat: 0,
    streakEligible: true,
  },
  RATING_SUBMITTED: {
    base: 1,
    dailyLimit: 3,
    decayPerRepeat: 0,
    streakEligible: false,
  },
};

const severityBonusMap = {
  Low: 1,
  Medium: 2,
  High: 4,
  Critical: 6,
};

const DAILY_POINTS_CAP = 24;

function getDayRange(baseDate = new Date(), offset = 0) {
  const date = new Date(baseDate);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  const start = date;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function formatAutoNote(action, total, breakdown, streakBonus) {
  const parts = breakdown
    .filter((item) => item.points > 0)
    .map((item) => `${item.label} +${item.points}`);

  if (streakBonus > 0) {
    parts.push(`Daily streak +${streakBonus}`);
  }

  return `${action}: +${total} pts${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

function calculateStreakFromEntries(entries = []) {
  if (!entries.length) return 0;

  const dayKeys = new Set(
    entries.map((entry) => {
      const d = new Date(entry.createdAt);
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    })
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  while (true) {
    const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth() + 1}-${cursor.getUTCDate()}`;
    if (!dayKeys.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

async function getTodayActionCount(userId, action) {
  const { start, end } = getDayRange(new Date(), 0);
  return PointsLedger.countDocuments({
    userId,
    action,
    createdAt: { $gte: start, $lt: end },
  });
}

async function isFirstContributionToday(userId) {
  const { start, end } = getDayRange(new Date(), 0);
  const count = await PointsLedger.countDocuments({
    userId,
    createdAt: { $gte: start, $lt: end },
  });
  return count === 0;
}

async function hasContributionYesterday(userId) {
  const { start, end } = getDayRange(new Date(), -1);
  const count = await PointsLedger.countDocuments({
    userId,
    createdAt: { $gte: start, $lt: end },
  });
  return count > 0;
}

async function getTodayTotalPoints(userId) {
  const { start, end } = getDayRange(new Date(), 0);
  const rows = await PointsLedger.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$points" },
      },
    },
  ]);

  return Number(rows?.[0]?.total || 0);
}

async function getTodayComplaintActionCount(userId, action, complaintId) {
  if (!complaintId) return 0;
  const { start, end } = getDayRange(new Date(), 0);
  return PointsLedger.countDocuments({
    userId,
    action,
    complaintId,
    createdAt: { $gte: start, $lt: end },
  });
}

async function hasAnyComplaintAction(userId, action, complaintId) {
  if (!complaintId) return false;
  const count = await PointsLedger.countDocuments({
    userId,
    action,
    complaintId,
  });
  return count > 0;
}

export function calculateActionPoints(action, context = {}) {
  const rule = actionRulebook[action];
  if (!rule) return { total: 0, breakdown: [] };

  const breakdown = [{ label: "Base", points: rule.base }];

  if (action === "COMPLAINT_REPORTED") {
    const severityBonus = severityBonusMap[context.severity] || 0;
    const descriptionLength = String(context.description || "").trim().length;
    const mediaCount = Array.isArray(context.mediaUrls) ? context.mediaUrls.length : 0;
    const evidenceBonus = Math.min(mediaCount, 2);
    const detailBonus = descriptionLength >= 180 ? 2 : descriptionLength >= 90 ? 1 : 0;
    const aiAssistBonus = context.aiAccepted && Number(context.aiConfidence || 0) >= 0.75 ? 1 : 0;

    breakdown.push(
      { label: "Severity", points: severityBonus },
      { label: "Evidence", points: evidenceBonus },
      { label: "Description quality", points: detailBonus },
      { label: "AI collaboration", points: aiAssistBonus }
    );
  }

  if (action === "COMMENT_ADDED") {
    const textLength = String(context.comment || "").trim().length;
    const qualityBonus = textLength >= 120 ? 2 : textLength >= 60 ? 1 : 0;
    breakdown.push({ label: "Constructive comment", points: qualityBonus });
  }

  if (action === "RATING_SUBMITTED") {
    const rating = Number(context.rating || 0);
    const resolutionBonus = rating >= 4 ? 2 : rating === 3 ? 1 : 0;
    breakdown.push({ label: "Resolution feedback", points: resolutionBonus });
  }

  const total = breakdown.reduce((sum, item) => sum + item.points, 0);
  return { total, breakdown };
}

export function getRank(points) {
  const ordered = [...rankRules].sort((a, b) => b.minPoints - a.minPoints);
  return ordered.find((rule) => points >= rule.minPoints)?.rank || "Civic Starter";
}

export async function awardPoints({ userId, action, note = "", complaintId = null, context = {}, points = null }) {
  if (!userId || !action) return null;

  const rule = actionRulebook[action];
  if (!rule) return null;

  const todayActionCount = await getTodayActionCount(userId, action);
  if (todayActionCount >= rule.dailyLimit) {
    return null;
  }

  if (action === "RATING_SUBMITTED") {
    const alreadyAwardedForComplaint = await hasAnyComplaintAction(userId, action, complaintId);
    if (alreadyAwardedForComplaint) {
      return null;
    }
  }

  if (action === "COMMENT_ADDED") {
    const commentsAwardedForComplaintToday = await getTodayComplaintActionCount(userId, action, complaintId);
    if (commentsAwardedForComplaintToday >= 2) {
      return null;
    }
  }

  const computed = typeof points === "number" ? { total: Number(points), breakdown: [] } : calculateActionPoints(action, context);
  let award = Number(computed.total || 0);
  if (award <= 0) return null;

  const todayTotal = await getTodayTotalPoints(userId);
  const remainingBudget = Math.max(0, DAILY_POINTS_CAP - todayTotal);
  if (remainingBudget <= 0) {
    return null;
  }

  if (rule.decayPerRepeat > 0 && todayActionCount > 0) {
    award = Math.max(1, award - todayActionCount * rule.decayPerRepeat);
  }

  let streakBonus = 0;
  if (rule.streakEligible) {
    const firstContributionToday = await isFirstContributionToday(userId);
    if (firstContributionToday) {
      const contributedYesterday = await hasContributionYesterday(userId);
      if (contributedYesterday) {
        streakBonus = 3;
      }
    }
  }

  const finalAward = award + streakBonus;
  const boundedAward = Math.max(0, Math.min(finalAward, remainingBudget));
  if (boundedAward <= 0) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  user.points += boundedAward;
  user.rank = getRank(user.points);
  await user.save();

  const recentEntries = await PointsLedger.find({ userId })
    .sort({ createdAt: -1 })
    .limit(60)
    .select("createdAt");

  const projectedStreak = calculateStreakFromEntries([
    { createdAt: new Date() },
    ...recentEntries,
  ]);

  await PointsLedger.create({
    userId,
    complaintId,
    action,
    points: boundedAward,
    note: note || formatAutoNote(action, boundedAward, computed.breakdown, streakBonus),
  });

  return {
    user,
    awardedPoints: boundedAward,
    streakDays: projectedStreak,
  };
}
