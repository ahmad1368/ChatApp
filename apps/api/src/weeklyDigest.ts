const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export type SetEmailResult = { success: true } | { success: false; error: string };

export interface DigestStats {
  likeCount: number;
  matchCount: number;
}

export interface DigestContent {
  subject: string;
  body: string;
}

/**
 * Tinder's real "Weekly digest emails" (#157) — kept independent of the
 * separate account-auth email system (auth.ts's AuthUser.email from
 * #21-#25) since that identity has no merged link to the swipe/match
 * activity tracked under this app's guest chat author identity (same
 * disclosed identity-merge gap as #135's genderInfo.ts note); an author
 * opts in with their own email here instead, keyed the same way as every
 * other per-author preference store (pinnedChats.ts, etc.).
 */
export class WeeklyDigestStore {
  private emailsByAuthor = new Map<string, string>();
  private lastSentAtByAuthor = new Map<string, number>();

  setEmail(author: unknown, email: unknown): SetEmailResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return { success: false, error: "A valid email is required" };
    }
    this.emailsByAuthor.set(authorName, trimmedEmail);
    return { success: true };
  }

  clearEmail(author: string): void {
    this.emailsByAuthor.delete(author);
    this.lastSentAtByAuthor.delete(author);
  }

  getEmail(author: string): string | undefined {
    return this.emailsByAuthor.get(author);
  }

  /** True once per week per author, only while they're opted in with an email. */
  needsWeeklyDigest(author: string, now: number = Date.now()): boolean {
    if (!this.emailsByAuthor.has(author)) return false;
    const lastSentAt = this.lastSentAtByAuthor.get(author);
    if (lastSentAt === undefined) return true;
    return now - lastSentAt >= DIGEST_INTERVAL_MS;
  }

  markSent(author: string, now: number = Date.now()): void {
    this.lastSentAtByAuthor.set(author, now);
  }

  /** Every author currently opted in, for a periodic sweep to check each for digest eligibility. */
  getSubscribedAuthors(): string[] {
    return [...this.emailsByAuthor.keys()];
  }
}

/**
 * The digest's actual content — reports current totals rather than a
 * "since last week" delta, since swipes.ts's SwipeStore doesn't timestamp
 * individual swipes; computing a precise weekly delta would need a larger
 * change to that store. A real deployment sends this via an email
 * provider (SES, SendGrid, etc.) — that needs credentials this
 * environment doesn't have, so the sweep in server.ts logs it
 * server-side instead, same stand-in used for SMS/recovery-email
 * delivery in auth.ts/recovery.ts.
 */
export function buildWeeklyDigest(stats: DigestStats): DigestContent {
  const likeText = `${stats.likeCount} ${stats.likeCount === 1 ? "person" : "people"} who liked you`;
  const matchText = `${stats.matchCount} active ${stats.matchCount === 1 ? "match" : "matches"}`;
  return {
    subject: "Your weekly ChatApp digest",
    body: `You have ${likeText} and ${matchText}. Open the app to see who!`,
  };
}
