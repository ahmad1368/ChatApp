export type SetVanishModeResult = { success: true; enabled: boolean } | { success: false; error: string };

/**
 * Bumble's real Incognito Mode (#111): with it on, an author is hidden from
 * everyone's discovery/top-picks queue *except* someone that author has
 * already liked or superliked — the same "stay dark to strangers, but still
 * reachable by people you deliberately swiped on" behavior Bumble ships,
 * rather than a blanket "invisible to everyone" toggle that would make it
 * impossible for a vanished author to ever get a match. This store is just
 * the on/off flag; the "already liked" exception is SwipeStore.hasLiked(),
 * composed with this in server.ts's isExcludedCandidate the same way #96's
 * discovery filters and #107's fake-profile scan are.
 */
export class VanishModeStore {
  private enabledAuthors = new Set<string>();

  setEnabled(author: unknown, enabled: unknown): SetVanishModeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (enabled === true) {
      this.enabledAuthors.add(authorName);
    } else {
      this.enabledAuthors.delete(authorName);
    }
    return { success: true, enabled: this.enabledAuthors.has(authorName) };
  }

  isEnabled(author: string): boolean {
    return this.enabledAuthors.has(author);
  }
}
