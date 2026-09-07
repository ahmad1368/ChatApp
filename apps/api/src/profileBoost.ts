export const BOOST_DURATION_MS = 30 * 60 * 1000; // 30 minutes, matching real Tinder Boost

export interface BoostStatus {
  active: boolean;
  expiresAt: string | null;
}

export type ActivateBoostResult = { success: true; expiresAt: string } | { success: false; error: string };

/**
 * Tinder's real "Boost" (#105): activating puts this author at the front
 * of everyone else's discovery order for 30 minutes — real Tinder sells
 * this; this app has no premium tier, so it's free here, same scoping
 * call as #92's free Rewind and #101's free Top Picks. One active boost
 * per author; activating again while already boosted simply resets the
 * 30-minute window from now rather than stacking duration.
 */
export class ProfileBoostStore {
  private expiresAtByAuthor = new Map<string, number>();

  activateBoost(author: unknown, now: number = Date.now()): ActivateBoostResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    const expiresAt = now + BOOST_DURATION_MS;
    this.expiresAtByAuthor.set(authorName, expiresAt);
    return { success: true, expiresAt: new Date(expiresAt).toISOString() };
  }

  isBoosted(author: string, now: number = Date.now()): boolean {
    const expiresAt = this.expiresAtByAuthor.get(author);
    return expiresAt !== undefined && expiresAt > now;
  }

  getStatus(author: string, now: number = Date.now()): BoostStatus {
    const expiresAt = this.expiresAtByAuthor.get(author);
    if (expiresAt === undefined || expiresAt <= now) {
      return { active: false, expiresAt: null };
    }
    return { active: true, expiresAt: new Date(expiresAt).toISOString() };
  }
}
