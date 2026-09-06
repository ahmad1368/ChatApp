import { BlockRecord } from "@chatapp/shared";

export type BlockResult =
  | { success: true; record: BlockRecord }
  | { success: false; error: string };

/**
 * Blocking is intentionally mutual for the purpose of "not re-encountering" someone:
 * once either side has blocked the other, neither should see the other's messages,
 * regardless of who initiated the block. We still track direction (blockerAuthor ->
 * blockedAuthor) so a user's own block list can be listed/undone, but no endpoint
 * exposes *who has blocked a given user* — only the blocker's own outgoing list.
 */
export class BlockStore {
  private blockedByBlocker = new Map<string, Set<string>>();

  block(blockerAuthor: unknown, blockedAuthor: unknown): BlockResult {
    const blocker = typeof blockerAuthor === "string" ? blockerAuthor.trim() : "";
    const blocked = typeof blockedAuthor === "string" ? blockedAuthor.trim() : "";

    if (!blocker || !blocked) {
      return { success: false, error: "blockerAuthor and blockedAuthor are required" };
    }
    if (blocker === blocked) {
      return { success: false, error: "Cannot block yourself" };
    }

    const set = this.blockedByBlocker.get(blocker) ?? new Set<string>();
    set.add(blocked);
    this.blockedByBlocker.set(blocker, set);

    return {
      success: true,
      record: { blockerAuthor: blocker, blockedAuthor: blocked, createdAt: new Date().toISOString() },
    };
  }

  unblock(blockerAuthor: unknown, blockedAuthor: unknown): boolean {
    const blocker = typeof blockerAuthor === "string" ? blockerAuthor.trim() : "";
    const blocked = typeof blockedAuthor === "string" ? blockedAuthor.trim() : "";
    const set = this.blockedByBlocker.get(blocker);
    if (!set) return false;
    return set.delete(blocked);
  }

  hasBlocked(blockerAuthor: string, blockedAuthor: string): boolean {
    return this.blockedByBlocker.get(blockerAuthor)?.has(blockedAuthor) ?? false;
  }

  /** True if either author has blocked the other. */
  isMutuallyBlocked(authorA: string, authorB: string): boolean {
    if (!authorA || !authorB) return false;
    return this.hasBlocked(authorA, authorB) || this.hasBlocked(authorB, authorA);
  }

  getBlockedAuthors(blockerAuthor: string): string[] {
    return Array.from(this.blockedByBlocker.get(blockerAuthor?.trim()) ?? []);
  }
}
