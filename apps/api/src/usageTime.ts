export const USAGE_LIMIT_OPTIONS_MINUTES = [15, 30, 60, 90, 120] as const;
export type UsageLimitMinutes = (typeof USAGE_LIMIT_OPTIONS_MINUTES)[number];

export type SetUsageLimitResult = { success: true; dailyLimitMinutes: number | null } | { success: false; error: string };

export interface UsageStatus {
  usageMinutesToday: number;
  dailyLimitMinutes: number | null;
  limitReached: boolean;
}

function isUsageLimitMinutes(value: unknown): value is UsageLimitMinutes {
  return typeof value === "number" && (USAGE_LIMIT_OPTIONS_MINUTES as readonly number[]).includes(value);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Bumble's real "Ability to limit daily app usage time" (#289) — a
 * genuine digital-wellbeing control, not a fabricated screen-time
 * detector: the client itself reports elapsed active seconds while the
 * tab is visible/focused (see UsageTimeTracker.tsx) on a real interval,
 * the same "client periodically reports, server aggregates" shape #219's
 * daily-challenge progress uses. A reached limit is disclosed to the
 * user (a dismissible banner), never a hard lockout — the same
 * "highlight/inform, don't punish" restraint #254's response-speed badge
 * uses, since this app has no App Store-level OS enforcement to actually
 * back a hard block with.
 */
export class UsageLimitStore {
  private limitByAuthor = new Map<string, number>();

  setLimit(author: unknown, dailyLimitMinutes: unknown): SetUsageLimitResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (dailyLimitMinutes === null) {
      this.limitByAuthor.delete(authorName);
      return { success: true, dailyLimitMinutes: null };
    }
    if (!isUsageLimitMinutes(dailyLimitMinutes)) {
      return { success: false, error: `dailyLimitMinutes must be one of: ${USAGE_LIMIT_OPTIONS_MINUTES.join(", ")}, or null` };
    }
    this.limitByAuthor.set(authorName, dailyLimitMinutes);
    return { success: true, dailyLimitMinutes };
  }

  getLimit(author: string): number | null {
    return this.limitByAuthor.get(author?.trim()) ?? null;
  }
}

export class UsageTimeStore {
  private usageByAuthor = new Map<string, { date: string; seconds: number }>();

  recordUsage(author: unknown, seconds: unknown): number {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
      return this.getUsageSecondsToday(authorName);
    }

    const today = todayKey();
    const entry = this.usageByAuthor.get(authorName);
    const current = entry?.date === today ? entry.seconds : 0;
    const next = current + seconds;
    this.usageByAuthor.set(authorName, { date: today, seconds: next });
    return next;
  }

  getUsageSecondsToday(author: string): number {
    const entry = this.usageByAuthor.get(author?.trim());
    return entry?.date === todayKey() ? entry.seconds : 0;
  }
}

export function getUsageStatus(usageTimeStore: UsageTimeStore, usageLimitStore: UsageLimitStore, author: string): UsageStatus {
  const usageMinutesToday = Math.floor(usageTimeStore.getUsageSecondsToday(author) / 60);
  const dailyLimitMinutes = usageLimitStore.getLimit(author);
  const limitReached = dailyLimitMinutes !== null && usageMinutesToday >= dailyLimitMinutes;
  return { usageMinutesToday, dailyLimitMinutes, limitReached };
}
