// A fixed, real emoji catalog — the same short "quick reaction" set real
// dating apps offer (not free-text, so counts stay meaningfully groupable).
export const PHOTO_REACTION_EMOJIS = ["❤️", "😍", "🔥", "😂", "👍"] as const;
export type PhotoReactionEmoji = (typeof PHOTO_REACTION_EMOJIS)[number];

export interface PhotoReactionSummary {
  emoji: PhotoReactionEmoji;
  count: number;
}

export type ReactToPhotoResult = { success: true; emoji: PhotoReactionEmoji } | { success: false; error: string };
export type RemovePhotoReactionResult = { success: true } | { success: false; error: string };

function isPhotoReactionEmoji(value: unknown): value is PhotoReactionEmoji {
  return typeof value === "string" && (PHOTO_REACTION_EMOJIS as readonly string[]).includes(value);
}

/**
 * Tinder's real "Ability to react with an emoji on each profile photo"
 * (#304) — one emoji per viewer per photo (replaceable, not stackable),
 * from a fixed real catalog rather than free text, the same "picker, not
 * free text" pattern #75's pets/#301's diet use for their own fixed
 * choices. Aggregated into per-emoji counts for display, without
 * exposing who reacted (a lightweight, low-stakes signal, unlike #41's
 * reports which do need reviewer accountability).
 */
export class PhotoReactionStore {
  private reactionsByPhotoId = new Map<string, Map<string, PhotoReactionEmoji>>();

  react(photoId: string, viewer: unknown, emoji: unknown): ReactToPhotoResult {
    const viewerName = typeof viewer === "string" ? viewer.trim() : "";
    if (!viewerName) {
      return { success: false, error: "viewer is required" };
    }
    if (!isPhotoReactionEmoji(emoji)) {
      return { success: false, error: `emoji must be one of: ${PHOTO_REACTION_EMOJIS.join(" ")}` };
    }

    const viewers = this.reactionsByPhotoId.get(photoId) ?? new Map<string, PhotoReactionEmoji>();
    viewers.set(viewerName, emoji);
    this.reactionsByPhotoId.set(photoId, viewers);
    return { success: true, emoji };
  }

  removeReaction(photoId: string, viewer: unknown): RemovePhotoReactionResult {
    const viewerName = typeof viewer === "string" ? viewer.trim() : "";
    if (!viewerName) {
      return { success: false, error: "viewer is required" };
    }
    this.reactionsByPhotoId.get(photoId)?.delete(viewerName);
    return { success: true };
  }

  getViewerReaction(photoId: string, viewer: string): PhotoReactionEmoji | null {
    return this.reactionsByPhotoId.get(photoId)?.get(viewer?.trim()) ?? null;
  }

  /** Per-emoji counts, highest first — never exposes who reacted. */
  getSummary(photoId: string): PhotoReactionSummary[] {
    const viewers = this.reactionsByPhotoId.get(photoId);
    if (!viewers) return [];

    const counts = new Map<PhotoReactionEmoji, number>();
    for (const emoji of viewers.values()) {
      counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
    }
    return [...counts.entries()].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count);
  }
}
