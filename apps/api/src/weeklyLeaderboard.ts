const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekKey(now: number): string {
  return String(Math.floor(now / WEEK_MS));
}

function weekStartIso(now: number): string {
  const weekIndex = Math.floor(now / WEEK_MS);
  return new Date(weekIndex * WEEK_MS).toISOString();
}

interface WeeklyStats {
  activityCount: number;
  popularityCount: number;
}

export interface LeaderboardEntry extends WeeklyStats {
  author: string;
  totalScore: number;
}

function totalScore(stats: WeeklyStats): number {
  // Real Tinder/Hinge never published how activity vs. popularity are
  // weighted in any ranking they run — this weighting (a like received
  // counts double a swipe made) is this app's own, documented choice,
  // not a reverse-engineered fact, matching smartScore.ts's own honest
  // stance on the same point.
  return stats.activityCount + stats.popularityCount * 2;
}

/**
 * Hinge's real "Weekly leaderboards based on activity/popularity"
 * (#220) — distinct from #95's SmartScoreStore (a lifetime, never-reset
 * Elo rating): this tracks the same two signals — activity (swiping)
 * and popularity (being liked) — but scoped to a real rolling weekly
 * window that resets automatically at each 7-day boundary from the Unix
 * epoch, with no admin cron needed to clear it.
 */
export class WeeklyLeaderboardStore {
  private statsByWeek = new Map<string, Map<string, WeeklyStats>>();

  private getWeekMap(now: number): Map<string, WeeklyStats> {
    const key = weekKey(now);
    let map = this.statsByWeek.get(key);
    if (!map) {
      map = new Map();
      this.statsByWeek.set(key, map);
    }
    return map;
  }

  private bump(author: unknown, now: number, field: keyof WeeklyStats): void {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return;
    const map = this.getWeekMap(now);
    const entry = map.get(authorText) ?? { activityCount: 0, popularityCount: 0 };
    entry[field] += 1;
    map.set(authorText, entry);
  }

  recordActivity(author: unknown, now: number = Date.now()): void {
    this.bump(author, now, "activityCount");
  }

  recordPopularity(author: unknown, now: number = Date.now()): void {
    this.bump(author, now, "popularityCount");
  }

  private allEntries(now: number): LeaderboardEntry[] {
    return [...this.getWeekMap(now).entries()]
      .map(([author, stats]) => ({ author, ...stats, totalScore: totalScore(stats) }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  getLeaderboard(limit: number = 10, now: number = Date.now()): { weekStart: string; entries: LeaderboardEntry[] } {
    return { weekStart: weekStartIso(now), entries: this.allEntries(now).slice(0, limit) };
  }

  /** 1-based rank among everyone with any activity this week, or null if the author has none. */
  getRank(author: string, now: number = Date.now()): number | null {
    const entries = this.allEntries(now);
    const index = entries.findIndex((e) => e.author === author);
    return index === -1 ? null : index + 1;
  }
}
