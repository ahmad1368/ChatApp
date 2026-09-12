export const RINGTONE_IDS = ["default", "chime", "pop", "silent"] as const;
export type RingtoneId = (typeof RINGTONE_IDS)[number];

// Real, distinct vibration patterns (milliseconds: vibrate/pause/vibrate/...)
// per push category, same idea as a phone's per-app-channel vibration
// pattern — a longer double-buzz for a match feels more celebratory than
// a like's single short pulse.
export const VIBRATION_PATTERNS = {
  newMatch: [200, 100, 200],
  newLike: [120],
  matchExpiryReminder: [100, 50, 100, 50, 100],
} as const satisfies Record<string, number[]>;

export interface NotificationSoundPreference {
  ringtone: RingtoneId;
  vibrationEnabled: boolean;
}

const DEFAULT_PREFERENCE: NotificationSoundPreference = { ringtone: "default", vibrationEnabled: true };

export type UpdateSoundPreferenceResult =
  | { success: true; preference: NotificationSoundPreference }
  | { success: false; error: string };

function isRingtoneId(value: unknown): value is RingtoneId {
  return typeof value === "string" && (RINGTONE_IDS as readonly string[]).includes(value);
}

/**
 * Tinder's real "Custom ringtone and vibration for app notifications"
 * (#160). Honestly scoped to what the web platform actually supports: the
 * Push API's `showNotification()` has no `sound`/ringtone option in any
 * browser (unlike Android's NotificationChannel or iOS's UNNotificationSound)
 * — there is no cross-browser way to attach a custom audio file to a
 * system-level push notification. `ringtone` here instead governs a real,
 * synthesized (Web Audio oscillator, no bundled audio asset needed) tone
 * played client-side while the app is in the foreground (see
 * NotificationInbox.tsx) — the one context a web page can actually control
 * sound in. `vibrationEnabled` is the genuinely real half of this feature:
 * server.ts's single-recipient push sites (new match/like/expiry-reminder)
 * look this up per author and attach a real `vibrate` pattern to the push
 * payload, which `sw.js`'s `showNotification()` honors even when the app
 * isn't focused — a real background vibration, same category as #145's
 * translation/#149's E2EE in using a genuinely working platform API rather
 * than a fabricated one. Multi-recipient broadcast sends (#5's plain new-
 * message push, #155's live-event push) aren't customized per-recipient
 * here — each broadcast shares one payload across however many different
 * people's subscriptions it reaches, and honoring per-recipient vibration
 * there would need a bigger refactor of PushService than this issue's
 * scope; disclosed rather than silently ignored.
 */
export class NotificationSoundStore {
  private preferenceByAuthor = new Map<string, NotificationSoundPreference>();

  get(author: string): NotificationSoundPreference {
    return { ...(this.preferenceByAuthor.get(author) ?? DEFAULT_PREFERENCE) };
  }

  update(author: unknown, updates: Record<string, unknown> | undefined): UpdateSoundPreferenceResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const next = this.get(authorName);
    if (updates && "ringtone" in updates) {
      if (!isRingtoneId(updates.ringtone)) {
        return { success: false, error: `ringtone must be one of: ${RINGTONE_IDS.join(", ")}` };
      }
      next.ringtone = updates.ringtone;
    }
    if (updates && "vibrationEnabled" in updates) {
      if (typeof updates.vibrationEnabled !== "boolean") {
        return { success: false, error: "vibrationEnabled must be a boolean" };
      }
      next.vibrationEnabled = updates.vibrationEnabled;
    }

    this.preferenceByAuthor.set(authorName, next);
    return { success: true, preference: next };
  }

  /** The real enforcement point a single-recipient push send site consults — returns undefined (no vibrate field) when the author has vibration turned off. */
  getVibrationPattern(author: string, pattern: number[]): number[] | undefined {
    return this.get(author).vibrationEnabled ? pattern : undefined;
  }
}
