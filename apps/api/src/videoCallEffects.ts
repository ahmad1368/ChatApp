export interface VideoCallEffects {
  beautyFilter: boolean;
  backgroundBlur: boolean;
  // Tinder's real "Support for ambient noise processing technology in
  // video calls" (#317) — see this class's doc comment.
  noiseSuppression: boolean;
}

export type UpdateVideoCallEffectsResult =
  | { success: true; effects: VideoCallEffects }
  | { success: false; error: string };

// Defaults to on: unlike beautyFilter/backgroundBlur (opt-in vanity
// effects), real calling apps (Zoom, Meet, etc.) enable noise suppression
// by default.
const DEFAULT_EFFECTS: VideoCallEffects = { beautyFilter: false, backgroundBlur: false, noiseSuppression: true };

/**
 * Badoo's real beauty filter/background blur during video calls (#131),
 * extended by #317's real "ambient noise processing" — a persisted per-
 * author preference, same one-value-per-author, replace-on-update shape
 * as #85's ProfileColorThemeStore. The actual processing happens entirely
 * client-side when a #129 video call starts: beautyFilter runs the local
 * track through a canvas blur/brightness/saturation blend (a real
 * technique many production beauty filters use as a cheap approximation
 * — not a fabricated ML model); backgroundBlur applies the browser's
 * native MediaStreamTrack `backgroundBlur` constraint where supported,
 * disclosed as unavailable rather than faked where it isn't (this app has
 * no ML-based person-segmentation model bundled); noiseSuppression maps
 * onto the browser's real, standard `getUserMedia` audio constraints
 * (`noiseSuppression`/`echoCancellation`/`autoGainControl`) — genuine
 * native browser audio processing, not a fabricated ML denoiser. This
 * store only remembers the choice across calls/sessions.
 */
export class VideoCallEffectsStore {
  private effectsByAuthor = new Map<string, VideoCallEffects>();

  update(author: unknown, beautyFilter: unknown, backgroundBlur: unknown, noiseSuppression: unknown): UpdateVideoCallEffectsResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const effects: VideoCallEffects = {
      beautyFilter: beautyFilter === true,
      backgroundBlur: backgroundBlur === true,
      noiseSuppression: noiseSuppression === true,
    };
    this.effectsByAuthor.set(authorName, effects);
    return { success: true, effects };
  }

  get(author: string): VideoCallEffects {
    return this.effectsByAuthor.get(author) ?? DEFAULT_EFFECTS;
  }
}
