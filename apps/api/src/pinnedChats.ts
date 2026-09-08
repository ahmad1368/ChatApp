export type PinChatResult =
  | { success: true; pinned: boolean }
  | { success: false; error: string };

/**
 * Bumble's real "Pin important chats to the top of the list" (#138). Pinning
 * is one-sided by design, same as #45's BlockStore pattern: each viewer has
 * their own pin list over the other side of a match, not a mutual/shared
 * flag — pinning a match doesn't pin it for the other person too.
 */
export class PinnedChatsStore {
  private pinnedByViewer = new Map<string, Set<string>>();

  private normalize(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  pin(viewerAuthor: unknown, chatAuthor: unknown): PinChatResult {
    const viewer = this.normalize(viewerAuthor);
    const chat = this.normalize(chatAuthor);
    if (!viewer || !chat) {
      return { success: false, error: "viewerAuthor and chatAuthor are required" };
    }
    if (viewer === chat) {
      return { success: false, error: "Cannot pin yourself" };
    }

    const set = this.pinnedByViewer.get(viewer) ?? new Set<string>();
    set.add(chat);
    this.pinnedByViewer.set(viewer, set);
    return { success: true, pinned: true };
  }

  unpin(viewerAuthor: unknown, chatAuthor: unknown): PinChatResult {
    const viewer = this.normalize(viewerAuthor);
    const chat = this.normalize(chatAuthor);
    if (!viewer || !chat) {
      return { success: false, error: "viewerAuthor and chatAuthor are required" };
    }

    this.pinnedByViewer.get(viewer)?.delete(chat);
    return { success: true, pinned: false };
  }

  isPinned(viewerAuthor: string, chatAuthor: string): boolean {
    return this.pinnedByViewer.get(viewerAuthor)?.has(chatAuthor) ?? false;
  }

  getPinnedChats(viewerAuthor: string): string[] {
    return Array.from(this.pinnedByViewer.get(viewerAuthor?.trim()) ?? []);
  }
}
