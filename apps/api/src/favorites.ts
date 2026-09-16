export type FavoriteResult = { success: true; favorited: boolean } | { success: false; error: string };

/**
 * Tinder's real "Ability to define a favorites list" (#279) — a personal
 * shortlist a viewer can save any discovery candidate to, independent of
 * swiping: favoriting doesn't record a like/pass in SwipeStore and doesn't
 * require a match, so it works as a "come back to this one later" bookmark
 * while browsing rather than a swipe decision. This is a different scope
 * from #138's PinnedChatsStore/#139's ArchivedChatsStore, which only ever
 * organize chats with existing matches — favorites apply to any profile a
 * viewer has seen, matched or not. One-sided by design, same as pin/archive
 * and #45's BlockStore: favoriting is a per-viewer preference, not mutual.
 */
export class FavoritesStore {
  private favoritesByViewer = new Map<string, Set<string>>();

  private normalize(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  addFavorite(viewerAuthor: unknown, targetAuthor: unknown): FavoriteResult {
    const viewer = this.normalize(viewerAuthor);
    const target = this.normalize(targetAuthor);
    if (!viewer || !target) {
      return { success: false, error: "viewerAuthor and targetAuthor are required" };
    }
    if (viewer === target) {
      return { success: false, error: "Cannot favorite yourself" };
    }

    const set = this.favoritesByViewer.get(viewer) ?? new Set<string>();
    set.add(target);
    this.favoritesByViewer.set(viewer, set);
    return { success: true, favorited: true };
  }

  removeFavorite(viewerAuthor: unknown, targetAuthor: unknown): FavoriteResult {
    const viewer = this.normalize(viewerAuthor);
    const target = this.normalize(targetAuthor);
    if (!viewer || !target) {
      return { success: false, error: "viewerAuthor and targetAuthor are required" };
    }

    this.favoritesByViewer.get(viewer)?.delete(target);
    return { success: true, favorited: false };
  }

  isFavorite(viewerAuthor: string, targetAuthor: string): boolean {
    return this.favoritesByViewer.get(viewerAuthor)?.has(targetAuthor) ?? false;
  }

  getFavorites(viewerAuthor: string): string[] {
    return Array.from(this.favoritesByViewer.get(viewerAuthor?.trim()) ?? []);
  }
}
