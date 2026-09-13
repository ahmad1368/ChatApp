export const RETENTION_WINDOWS_DAYS = [1, 7, 30] as const;

export interface RetentionWindowResult {
  windowDays: number;
  eligibleUsers: number;
  retainedUsers: number;
  retentionRate: number;
}

export interface RetentionUserInput {
  createdAtMs: number;
  lastActiveAtMs: number | undefined;
}

/**
 * Bumble's real "View user retention rate" (#189). Signup time comes
 * from UserStore.createdAt; "returned" comes from TokenService's
 * per-session lastUsedAt (updated on token refresh) — the same
 * authenticated userId identity space both stores already share, unlike
 * the self-reported chat `author` string PresenceStore/SwipeStore use
 * elsewhere in this app, so this is the one place retention can
 * actually be computed without inventing a mapping between two
 * identity spaces that don't otherwise correspond. A user counts as
 * retained for a window if their most recent activity is at least that
 * many days after they signed up; only users old enough to possibly
 * qualify (signed up at least that many days ago) count toward the
 * denominator, the standard cohort-retention convention.
 */
export function computeRetention(
  users: RetentionUserInput[],
  windowsDays: readonly number[] = RETENTION_WINDOWS_DAYS,
  nowMs: number = Date.now()
): RetentionWindowResult[] {
  return windowsDays.map((windowDays) => {
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    let eligibleUsers = 0;
    let retainedUsers = 0;
    for (const user of users) {
      if (nowMs - user.createdAtMs < windowMs) continue;
      eligibleUsers++;
      const lastActiveAtMs = user.lastActiveAtMs ?? user.createdAtMs;
      if (lastActiveAtMs - user.createdAtMs >= windowMs) retainedUsers++;
    }
    return {
      windowDays,
      eligibleUsers,
      retainedUsers,
      retentionRate: eligibleUsers === 0 ? 0 : retainedUsers / eligibleUsers,
    };
  });
}
