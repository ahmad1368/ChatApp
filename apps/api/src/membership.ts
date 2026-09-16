/**
 * Tinder's real "Show the user's membership duration on the platform"
 * (#300) — this app's dating features operate on a lightweight guest
 * identity (see guestIdentity.ts), not #21-28's separate real-account
 * `UserStore` (which already has its own real `createdAt`, but is keyed
 * by credentials, not the public guest author string every profile is
 * shown by). `recordFirstSeen()` is idempotent: the first time the
 * server ever sees a given author, that moment is stamped as their join
 * date and never overwritten by a later call — the same "first write
 * wins" shape a real join date needs.
 */
export class MembershipStore {
  private joinedAtByAuthor = new Map<string, string>();

  recordFirstSeen(author: unknown, now: number = Date.now()): string | null {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return null;

    const existing = this.joinedAtByAuthor.get(authorName);
    if (existing) return existing;

    const joinedAt = new Date(now).toISOString();
    this.joinedAtByAuthor.set(authorName, joinedAt);
    return joinedAt;
  }

  getJoinedAt(author: string): string | null {
    return this.joinedAtByAuthor.get(author?.trim()) ?? null;
  }
}
