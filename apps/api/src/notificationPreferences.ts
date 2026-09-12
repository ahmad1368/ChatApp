// Tinder's real "unified notification service with categorization... and
// per-category user preferences enforced at send time" (#156). Named
// after the six push categories this app actually sends: #5's new
// message, #151's new match, #153's new like, #154's match-expiry
// reminder, #155's live-event start, and #178's admin broadcast. All
// default to enabled — this is an opt-out control, not an opt-in one,
// matching every real dating app's default of "notifications on until
// you turn them off."
export const NOTIFICATION_CATEGORIES = [
  "newMessage",
  "newMatch",
  "newLike",
  "matchExpiryReminder",
  "liveEventStart",
  "adminBroadcast",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationPreferences = Record<NotificationCategory, boolean>;

const DEFAULT_PREFERENCES: NotificationPreferences = {
  newMessage: true,
  newMatch: true,
  newLike: true,
  matchExpiryReminder: true,
  liveEventStart: true,
  adminBroadcast: true,
};

export type UpdatePreferencesResult = { success: true; preferences: NotificationPreferences } | { success: false; error: string };

function isNotificationCategory(value: string): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Per-author preferences, one boolean per category — same one-preference-
 * store-per-author shape as pinnedChats.ts/archivedChats.ts. `isEnabled()`
 * is the actual enforcement point: every push send site should check it
 * for the category it's about to send before calling PushService, the
 * same way message:send already checks #56's scam filter before
 * broadcasting. As of this feature, only #5's message:send actually
 * calls it (for "newMessage") — #151/#153/#154/#155's push call sites
 * live on their own not-yet-merged branches and should each add their
 * own `isEnabled(recipient, "<category>")` check once merged, the same
 * way #58's spam auto-report was wired in after ReportStore already
 * existed.
 */
export class NotificationPreferencesStore {
  private preferencesByAuthor = new Map<string, NotificationPreferences>();

  get(author: string): NotificationPreferences {
    return { ...(this.preferencesByAuthor.get(author) ?? DEFAULT_PREFERENCES) };
  }

  update(author: unknown, updates: Record<string, unknown> | undefined): UpdatePreferencesResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const next = this.get(authorName);
    for (const [key, value] of Object.entries(updates ?? {})) {
      if (!isNotificationCategory(key)) {
        return { success: false, error: `Unknown notification category: ${key}` };
      }
      if (typeof value !== "boolean") {
        return { success: false, error: `${key} must be a boolean` };
      }
      next[key] = value;
    }

    this.preferencesByAuthor.set(authorName, next);
    return { success: true, preferences: next };
  }

  /** The actual enforcement check a push send site consults before notifying this author for this category. */
  isEnabled(author: string, category: NotificationCategory): boolean {
    return this.get(author)[category];
  }
}
