export type ArchiveChatResult =
  | { success: true; archived: boolean }
  | { success: false; error: string };

/**
 * Bumble's real "Archive old chats" (#139). Archiving is one-sided by
 * design, same as #45's BlockStore and #138's PinnedChatsStore: each
 * viewer has their own archive list over the other side of a match,
 * not a mutual/shared flag — archiving a match doesn't archive it for
 * the other person too, and doesn't affect matching/expiry (#136/#137)
 * at all, it's purely a list-visibility preference.
 */
export class ArchivedChatsStore {
  private archivedByViewer = new Map<string, Set<string>>();

  private normalize(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  archive(viewerAuthor: unknown, chatAuthor: unknown): ArchiveChatResult {
    const viewer = this.normalize(viewerAuthor);
    const chat = this.normalize(chatAuthor);
    if (!viewer || !chat) {
      return { success: false, error: "viewerAuthor and chatAuthor are required" };
    }
    if (viewer === chat) {
      return { success: false, error: "Cannot archive yourself" };
    }

    const set = this.archivedByViewer.get(viewer) ?? new Set<string>();
    set.add(chat);
    this.archivedByViewer.set(viewer, set);
    return { success: true, archived: true };
  }

  unarchive(viewerAuthor: unknown, chatAuthor: unknown): ArchiveChatResult {
    const viewer = this.normalize(viewerAuthor);
    const chat = this.normalize(chatAuthor);
    if (!viewer || !chat) {
      return { success: false, error: "viewerAuthor and chatAuthor are required" };
    }

    this.archivedByViewer.get(viewer)?.delete(chat);
    return { success: true, archived: false };
  }

  isArchived(viewerAuthor: string, chatAuthor: string): boolean {
    return this.archivedByViewer.get(viewerAuthor)?.has(chatAuthor) ?? false;
  }

  getArchivedChats(viewerAuthor: string): string[] {
    return Array.from(this.archivedByViewer.get(viewerAuthor?.trim()) ?? []);
  }
}
