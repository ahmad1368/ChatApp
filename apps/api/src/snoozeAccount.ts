export type SetSnoozeResult = { success: true; enabled: boolean } | { success: false; error: string };

/**
 * Bumble's real Snooze Mode (#164): "hide profile without deleting the
 * account" — a full pause, distinct from #111's Incognito/Vanish Mode
 * (vanishMode.ts), which only hides an author from strangers while still
 * letting anyone they've already liked find them. Snooze has no such
 * exception: a snoozed author is excluded from *everyone's* discovery
 * pool unconditionally (see server.ts's isExcludedCandidate), and can't
 * swipe on new candidates themselves either — the whole account pauses,
 * not just the swiper's own visibility to others. Existing matches and
 * chats are deliberately untouched: this store only gates discovery and
 * outgoing swipes, never messages.ts/matches — "without deleting the
 * account" means what's already yours stays reachable.
 */
export class SnoozeAccountStore {
  private snoozedAuthors = new Set<string>();

  setEnabled(author: unknown, enabled: unknown): SetSnoozeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (enabled === true) {
      this.snoozedAuthors.add(authorName);
    } else {
      this.snoozedAuthors.delete(authorName);
    }
    return { success: true, enabled: this.snoozedAuthors.has(authorName) };
  }

  isEnabled(author: string): boolean {
    return this.snoozedAuthors.has(author);
  }
}
