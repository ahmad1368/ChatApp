const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_GOAL_LENGTH = 140;

function weekKey(now: number): string {
  return String(Math.floor(now / WEEK_MS));
}

export interface WeeklyGoal {
  goal: string;
  weekStartIso: string | null;
}

export type UpdateWeeklyGoalResult = { success: true; weeklyGoal: WeeklyGoal } | { success: false; error: string };

const EMPTY_WEEKLY_GOAL: WeeklyGoal = { goal: "", weekStartIso: null };

/**
 * Tinder's real "Ability to define 'my goal this week' in the profile"
 * (#258) — distinct from #29's one-time onboarding relationship-intent
 * choice (marriage/friendship/casual): a short free-text statement that
 * genuinely resets every calendar week with no admin cron needed, the
 * same real epoch-week boundary #220's WeeklyLeaderboardStore already
 * uses. A goal set in a previous epoch week reads back as unset rather
 * than stale leftover text from weeks ago.
 */
export class WeeklyGoalStore {
  private goalByAuthor = new Map<string, { goal: string; weekKey: string }>();

  update(author: unknown, goal: unknown, now: number = Date.now()): UpdateWeeklyGoalResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    const text = typeof goal === "string" ? goal.trim().slice(0, MAX_GOAL_LENGTH) : "";
    this.goalByAuthor.set(authorName, { goal: text, weekKey: weekKey(now) });
    return { success: true, weeklyGoal: this.get(authorName, now) };
  }

  get(author: string, now: number = Date.now()): WeeklyGoal {
    const stored = this.goalByAuthor.get(author);
    if (!stored || stored.weekKey !== weekKey(now) || !stored.goal) {
      return EMPTY_WEEKLY_GOAL;
    }
    return { goal: stored.goal, weekStartIso: new Date(Number(stored.weekKey) * WEEK_MS).toISOString() };
  }
}
