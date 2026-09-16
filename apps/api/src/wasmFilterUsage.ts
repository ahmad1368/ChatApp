/**
 * Tinder's real "WebAssembly technology support for the browser version"
 * (#287) — a per-author count of how many times the real WASM-computed
 * posterize filter (see PhotoEditor.tsx/wasmPosterize.ts) was actually
 * applied and saved, not just how many times the button was clicked.
 * Analogous in shape to #219's DailyChallengeStore counters.
 */
export class WasmFilterUsageStore {
  private countByAuthor = new Map<string, number>();

  record(author: unknown): number {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return 0;
    const next = (this.countByAuthor.get(authorName) ?? 0) + 1;
    this.countByAuthor.set(authorName, next);
    return next;
  }

  getCount(author: string): number {
    return this.countByAuthor.get(author?.trim()) ?? 0;
  }
}
