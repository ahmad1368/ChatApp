export type SaveDraftResult = { success: true } | { success: false; error: string };

/**
 * Bumble's real "save message drafts" (#150): the composer's unsent text
 * persists per author per room, so leaving a conversation before sending
 * doesn't lose it — same one-preference-per-(author, key) shape as
 * pinnedChats.ts/archivedChats.ts, keyed by roomId instead of by another
 * author. Server-persisted (not just localStorage) so a draft survives
 * across devices/browsers, unlike a purely client-side draft.
 */
export class MessageDraftStore {
  private draftsByAuthor = new Map<string, Map<string, string>>();

  save(author: unknown, roomId: unknown, text: unknown): SaveDraftResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const room = typeof roomId === "string" ? roomId.trim() : "";
    if (!authorName || !room) {
      return { success: false, error: "author and roomId are required" };
    }
    if (typeof text !== "string") {
      return { success: false, error: "text must be a string" };
    }

    const drafts = this.draftsByAuthor.get(authorName) ?? new Map<string, string>();
    if (text.trim()) {
      drafts.set(room, text);
    } else {
      // An empty draft means "nothing left to save" — clear it rather
      // than storing a blank string, same effect as clear() below.
      drafts.delete(room);
    }
    this.draftsByAuthor.set(authorName, drafts);
    return { success: true };
  }

  get(author: string, roomId: string): string {
    return this.draftsByAuthor.get(author)?.get(roomId) ?? "";
  }

  clear(author: unknown, roomId: unknown): void {
    const authorName = typeof author === "string" ? author.trim() : "";
    const room = typeof roomId === "string" ? roomId.trim() : "";
    if (!authorName || !room) return;
    this.draftsByAuthor.get(authorName)?.delete(room);
  }
}
