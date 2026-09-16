/**
 * Tinder's real "Ability to measure user activity level as a percentage"
 * (#252) — a normalized comparative percentage, distinct from #95's raw
 * absolute swipe count and Elo rating and #220's ordinal weekly rank:
 * what percentage of other tracked authors this author is at least as
 * active as. Scoped to authors #95's SmartScoreStore has actually seen
 * swipe at least once — this app has no central "every user" roster to
 * compare against (guest identities, opportunistic per-author maps
 * throughout), the same real-data-only scope #220's leaderboard already
 * accepts. With no comparison data yet (nobody has swiped, including this
 * author), reports 100 — honestly, rather than an arbitrary placeholder.
 */
export function computeActivityPercentile(activityCount: number, allActivityCounts: number[]): number {
  const comparisonPool = allActivityCounts.length > 0 ? allActivityCounts : [activityCount];
  const atOrBelow = comparisonPool.filter((count) => count <= activityCount).length;
  return Math.round((atOrBelow / comparisonPool.length) * 100);
}
