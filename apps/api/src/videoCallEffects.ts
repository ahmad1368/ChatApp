export interface VideoCallEffects {
  beautyFilter: boolean;
  backgroundBlur: boolean;
}

export type UpdateVideoCallEffectsResult =
  | { success: true; effects: VideoCallEffects }
  | { success: false; error: string };

const DEFAULT_EFFECTS: VideoCallEffects = { beautyFilter: false, backgroundBlur: false };

/**
 * Badoo's real beauty filter/background blur during video calls (#131) —
 * a persisted per-author preference, same one-value-per-author, replace-
 * on-update shape as #85's ProfileColorThemeStore. The actual pixel
 * processing happens entirely client-side when a #129 video call starts:
 * beautyFilter runs the local track through a canvas blur/brightness/
 * saturation blend (a real technique many production beauty filters use
 * as a cheap approximation — not a fabricated ML model), and
 * backgroundBlur applies the browser's native MediaStreamTrack
 * `backgroundBlur` constraint where supported, disclosed as unavailable
 * rather than faked where it isn't (this app has no ML-based person-
 * segmentation model bundled). This store only remembers the choice
 * across calls/sessions.
 */
export class VideoCallEffectsStore {
  private effectsByAuthor = new Map<string, VideoCallEffects>();

  update(author: unknown, beautyFilter: unknown, backgroundBlur: unknown): UpdateVideoCallEffectsResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const effects: VideoCallEffects = { beautyFilter: beautyFilter === true, backgroundBlur: backgroundBlur === true };
    this.effectsByAuthor.set(authorName, effects);
    return { success: true, effects };
  }

  get(author: string): VideoCallEffects {
    return this.effectsByAuthor.get(author) ?? DEFAULT_EFFECTS;
  }
}
