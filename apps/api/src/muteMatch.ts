export const MUTE_DURATION_HOURS = [1, 4, 8, 24] as const;
export type MuteDurationHours = (typeof MUTE_DURATION_HOURS)[number];

export type MuteMatchResult = { success: true; mutedUntil: string } | { success: false; error: string };

function isMuteDurationHours(value: unknown): value is MuteDurationHours {
  return typeof value === "number" && (MUTE_DURATION_HOURS as readonly number[]).includes(value);
}

/**
 * Tinder's real "Ability to mute messages from a specific Match for a few
 * hours" (#311) — a real expiring, per-(viewer, match) timestamp from a
 * fixed real duration catalog (1/4/8/24 hours), not a permanent block
 * (see blocks.ts) or a global notification-category toggle (#156's
 * `NotificationPreferencesStore`). Enforced in server.ts's `message:new`
 * push-notification predicate: a muted match's messages still arrive in
 * the chat itself, only the push notification is suppressed while muted.
 */
export class MuteMatchStore {
  private mutedUntilByPair = new Map<string, number>();

  private key(author: string, match: string): string {
    return `${author}:${match}`;
  }

  mute(author: unknown, match: unknown, hours: unknown, now: number = Date.now()): MuteMatchResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const matchName = typeof match === "string" ? match.trim() : "";
    if (!authorName || !matchName) {
      return { success: false, error: "author and match are required" };
    }
    if (authorName === matchName) {
      return { success: false, error: "Cannot mute yourself" };
    }
    if (!isMuteDurationHours(hours)) {
      return { success: false, error: `hours must be one of: ${MUTE_DURATION_HOURS.join(", ")}` };
    }

    const mutedUntil = now + hours * 60 * 60 * 1000;
    this.mutedUntilByPair.set(this.key(authorName, matchName), mutedUntil);
    return { success: true, mutedUntil: new Date(mutedUntil).toISOString() };
  }

  unmute(author: string, match: string): void {
    this.mutedUntilByPair.delete(this.key(author, match));
  }

  isMuted(author: string, match: string, now: number = Date.now()): boolean {
    const mutedUntil = this.mutedUntilByPair.get(this.key(author, match));
    if (mutedUntil === undefined) return false;
    if (now >= mutedUntil) {
      this.mutedUntilByPair.delete(this.key(author, match));
      return false;
    }
    return true;
  }

  getMutedUntil(author: string, match: string, now: number = Date.now()): string | null {
    return this.isMuted(author, match, now) ? new Date(this.mutedUntilByPair.get(this.key(author, match))!).toISOString() : null;
  }
}
