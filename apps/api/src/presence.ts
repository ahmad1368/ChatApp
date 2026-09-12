export interface PresenceStatus {
  online: boolean;
  lastActiveAt: string | null;
}

/**
 * Badoo's real online/last-active indicator (#110): "online" reflects a
 * live Socket.io connection (see server.ts's presence:online/disconnect
 * handlers), "last active" is the most recent moment that connection was
 * open or the author sent a message. A per-author connection count
 * (rather than a boolean) is tracked so a user with the app open in two
 * tabs doesn't flicker offline the instant one tab closes — only when
 * every connection for that author has closed.
 */
export class PresenceStore {
  private connectionCountByAuthor = new Map<string, number>();
  private lastActiveAtByAuthor = new Map<string, number>();

  markOnline(author: string, now: number = Date.now()): void {
    const count = this.connectionCountByAuthor.get(author) ?? 0;
    this.connectionCountByAuthor.set(author, count + 1);
    this.lastActiveAtByAuthor.set(author, now);
  }

  markOffline(author: string, now: number = Date.now()): void {
    const count = this.connectionCountByAuthor.get(author) ?? 0;
    if (count <= 1) {
      this.connectionCountByAuthor.delete(author);
    } else {
      this.connectionCountByAuthor.set(author, count - 1);
    }
    this.lastActiveAtByAuthor.set(author, now);
  }

  recordActivity(author: string, now: number = Date.now()): void {
    this.lastActiveAtByAuthor.set(author, now);
  }

  isOnline(author: string): boolean {
    return (this.connectionCountByAuthor.get(author) ?? 0) > 0;
  }

  getStatus(author: string): PresenceStatus {
    const lastActiveAtMs = this.lastActiveAtByAuthor.get(author);
    return {
      online: this.isOnline(author),
      lastActiveAt: lastActiveAtMs !== undefined ? new Date(lastActiveAtMs).toISOString() : null,
    };
  }

  /**
   * How many distinct authors have been active (online, or activity
   * recorded) within the given window — #179's real "daily active users"
   * metric, computed from this app's own activity timestamps rather than
   * a fabricated analytics pipeline.
   */
  getActiveWithinCount(windowMs: number, now: number = Date.now()): number {
    let count = 0;
    for (const lastActiveAtMs of this.lastActiveAtByAuthor.values()) {
      if (now - lastActiveAtMs <= windowMs) count++;
    }
    return count;
  }
}
