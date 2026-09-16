export type UpdateStrangerPictureBlockResult = { success: true; enabled: boolean } | { success: false; error: string };

/**
 * Tinder's real "Setting to not receive picture messages from strangers"
 * (#281) — this app's chat is one shared room (see server.ts's
 * DEFAULT_ROOM_ID and unmatch()'s doc comment), not per-match DM threads,
 * so anyone can technically post an `imageUrl`/`selfDestructImageUrl`
 * message to it whether or not they've matched the viewer. This is an
 * opt-in per-viewer preference: once enabled, `shouldHidePicture()` says
 * whether a given picture message should be hidden from that viewer,
 * exactly the same "server has no per-socket delivery to filter against
 * without breaking #20's Redis-backed broadcast, so REST re-fetches filter
 * server-side and live `message:new` filters client-side" split #16's
 * BlockStore already established for blocked authors (see
 * `/api/rooms/:roomId/messages`'s `viewer=` filtering and ChatRoom.tsx's
 * `visibleMessages`).
 */
export class StrangerPictureBlockStore {
  private enabledByAuthor = new Map<string, boolean>();

  get(author: string): boolean {
    return this.enabledByAuthor.get(author?.trim()) ?? false;
  }

  update(author: unknown, enabled: unknown): UpdateStrangerPictureBlockResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (typeof enabled !== "boolean") {
      return { success: false, error: "enabled must be a boolean" };
    }
    this.enabledByAuthor.set(authorName, enabled);
    return { success: true, enabled };
  }

  /** Whether a picture message from `sender` should be hidden from `viewer`, given `viewer`'s own matches. */
  shouldHidePicture(viewer: string, sender: string, hasPicture: boolean, isMatch: boolean): boolean {
    if (!hasPicture || viewer === sender || isMatch) return false;
    return this.get(viewer);
  }
}
