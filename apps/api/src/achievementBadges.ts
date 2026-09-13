export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
}

/**
 * Hinge's real "Achievement badges and medals" (#213) — distinct from
 * #87's AchievementsInfoStore (a user-entered "official achievements"
 * profile field for real-life degrees/awards): this is app-earned
 * gamification, a fixed badge catalog awarded automatically the moment a
 * real milestone happens elsewhere in the app (a match, a 7-day #212
 * login streak, a 100% #86 profile completion) — never something a user
 * can self-claim. award() is the idempotent "state machine" primitive
 * the issue's implementation guide asks for: badges, once earned, are
 * never revoked even if the underlying stat later changes (e.g. profile
 * completion drops back below 100%).
 */
export const ACHIEVEMENT_BADGES: AchievementBadge[] = [
  { id: "first-match", name: "First Match", description: "Matched with someone for the first time" },
  { id: "week-streak", name: "Week Streak", description: "Checked in 7 days in a row" },
  { id: "profile-complete", name: "Profile Perfectionist", description: "Completed 100% of your profile" },
];

const BADGE_IDS = new Set(ACHIEVEMENT_BADGES.map((badge) => badge.id));

export interface EarnedBadge extends AchievementBadge {
  earnedAt: string;
}

export class AchievementBadgeStore {
  private earnedByAuthor = new Map<string, Map<string, string>>();

  /** Returns whether this call newly awarded the badge (false if already earned, unknown badge, or missing author). */
  award(author: unknown, badgeId: string): boolean {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText || !BADGE_IDS.has(badgeId)) return false;

    let earned = this.earnedByAuthor.get(authorText);
    if (!earned) {
      earned = new Map();
      this.earnedByAuthor.set(authorText, earned);
    }
    if (earned.has(badgeId)) return false;

    earned.set(badgeId, new Date().toISOString());
    return true;
  }

  getEarnedBadges(author: string): EarnedBadge[] {
    const earned = this.earnedByAuthor.get(author);
    if (!earned) return [];
    return ACHIEVEMENT_BADGES.filter((badge) => earned.has(badge.id)).map((badge) => ({ ...badge, earnedAt: earned.get(badge.id)! }));
  }
}
