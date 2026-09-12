export type RecordClearResult = { success: true; clearedAt: string } | { success: false; error: string };

/**
 * Feeld's real "Clear app cache" (#167). The actual cache-clearing work
 * happens entirely client-side (see apps/web/src/app/clearCache.ts) —
 * `caches.keys()`/`caches.delete()` against this PWA's real service-
 * worker Cache Storage (sw.js's CACHE_NAME); the server holds no
 * per-user response cache to clear, since every API response here is
 * computed live. This store is just an audit log of when a client last
 * reported clearing its own cache — same "client reports, server
 * records" shape as #166's PermissionsStatusStore — useful for a
 * "Last cleared: 3 days ago" line the UI can show without the browser
 * needing to keep that timestamp itself (clearing the cache is exactly
 * the kind of action a client-only value would be lost by).
 */
export class CacheClearLogStore {
  private lastClearedAtByAuthor = new Map<string, string>();

  recordClear(author: unknown): RecordClearResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    const clearedAt = new Date().toISOString();
    this.lastClearedAtByAuthor.set(authorName, clearedAt);
    return { success: true, clearedAt };
  }

  getLastClearedAt(author: string): string | null {
    return this.lastClearedAtByAuthor.get(author) ?? null;
  }
}
