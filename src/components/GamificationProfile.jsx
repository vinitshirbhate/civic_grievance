import React from "react";

const rankToneClass = {
    "Civic Starter": "rank-starter",
    "Ward Watcher": "rank-watcher",
    "Community Helper": "rank-helper",
    "Neighborhood Hero": "rank-hero",
    "City Champion": "rank-champion",
    "Urban Guardian": "rank-guardian",
    "Nagar Sentinel": "rank-sentinel",
};

const fallbackSummary = (userProfile) => ({
    totalPoints: userProfile?.points || 0,
    rank: userProfile?.rank || "Civic Starter",
    trustScore: userProfile?.trustScore || 50,
    weeklyPoints: 0,
    monthlyPoints: 0,
    activeStreakDays: 0,
    pointsToNextRank: 0,
    progressToNextRankPct: 0,
    nextRank: null,
    badges: [],
    trend: [],
    actionCount: { complaints: 0, comments: 0, ratings: 0 },
});

const GamificationProfile = ({ userProfile, summary }) => {
    if (!userProfile && !summary) {
        return (
            <div className="gamification-shell animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/4 mb-5" />
                <div className="h-20 bg-slate-200 rounded mb-4" />
                <div className="h-20 bg-slate-200 rounded" />
            </div>
        );
    }

    const data = summary || fallbackSummary(userProfile);
    const rankClass = rankToneClass[data.rank] || "rank-starter";
    const displayName = userProfile?.name || "Citizen";
    const visibleBadges = (data.badges || []).slice(0, 3);

    return (
        <section className="gamification-shell">
            <div className="gamification-header">
                <div>
                    <p className="gamification-kicker">Citizen Impact Engine</p>
                    <h3 className="gamification-title">{displayName}</h3>
                    <p className="gamification-subtitle">{data.rank} • Smart points based on quality, consistency, and useful participation.</p>
                </div>
                <div className={`gamification-points-tile ${rankClass}`}>
                    <p>Total Points</p>
                    <h4>{data.totalPoints}</h4>
                </div>
            </div>

            <div className="gamification-progress-wrap">
                <div className="flex items-center justify-between text-sm mb-2">
                    <p>
                        {data.nextRank ? `Progress to ${data.nextRank.name}` : "Top civic rank reached"}
                    </p>
                    <p>{data.nextRank ? `${data.pointsToNextRank} pts left` : "100%"}</p>
                </div>
                <div className="gamification-progress-track">
                    <div className="gamification-progress-fill" style={{ width: `${Math.max(4, data.progressToNextRankPct || 0)}%` }} />
                </div>
            </div>

            <div className="gamification-metrics-grid">
                <article className="gamification-metric-card">
                    <p>Active Streak</p>
                    <h4>{data.activeStreakDays} days</h4>
                </article>
                <article className="gamification-metric-card">
                    <p>Weekly Points</p>
                    <h4>+{data.weeklyPoints}</h4>
                </article>
                <article className="gamification-metric-card">
                    <p>Monthly Points</p>
                    <h4>+{data.monthlyPoints}</h4>
                </article>
                <article className="gamification-metric-card">
                    <p>Trust Score</p>
                    <h4>{data.trustScore}/100</h4>
                </article>
            </div>

            <article className="gamification-panel mt-3">
                <p className="gamification-panel-title">Activity Snapshot</p>
                <div className="gamification-action-list compact">
                    <div>
                        <p>Complaints</p>
                        <span>{data.actionCount?.complaints || 0}</span>
                    </div>
                    <div>
                        <p>Comments</p>
                        <span>{data.actionCount?.comments || 0}</span>
                    </div>
                    <div>
                        <p>Ratings</p>
                        <span>{data.actionCount?.ratings || 0}</span>
                    </div>
                </div>
            </article>

            {visibleBadges.length ? (
                <article className="gamification-panel mt-3">
                    <p className="gamification-panel-title">Top Badges</p>
                    <div className="gamification-badges">
                        {visibleBadges.map((badge) => (
                            <div key={badge.key} className={`gamification-badge ${badge.unlocked ? "unlocked" : "locked"}`}>
                                <p>{badge.title}</p>
                                <span>{badge.unlocked ? "Unlocked" : badge.hint}</span>
                            </div>
                        ))}
                    </div>
                </article>
            ) : null}
        </section>
    );
};

export default GamificationProfile;

