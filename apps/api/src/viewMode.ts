export const VIEW_MODES = ["card", "grid", "list"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const DEFAULT_VIEW_MODE: ViewMode = "card";

export type SetViewModeResult = { success: true; mode: ViewMode } | { success: false; error: string };

function isViewMode(value: unknown): value is ViewMode {
  return typeof value === "string" && (VIEW_MODES as readonly string[]).includes(value);
}

/**
 * OkCupid's real DoubleTake-style grid browsing as an alternative to
 * Tinder's one-at-a-time swipe deck (#115) — a persisted per-author
 * display preference, same "store the choice, let the discovery UI read
 * it" shape as #99's ExploreModeStore, rather than a client-only toggle
 * that forgets itself on the next visit or device.
 */
export class ViewModeStore {
  private modeByAuthor = new Map<string, ViewMode>();

  get(author: string): ViewMode {
    return this.modeByAuthor.get(author) ?? DEFAULT_VIEW_MODE;
  }

  set(author: unknown, mode: unknown): SetViewModeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!isViewMode(mode)) {
      return { success: false, error: `mode must be one of: ${VIEW_MODES.join(", ")}` };
    }
    this.modeByAuthor.set(authorName, mode);
    return { success: true, mode };
  }
}
