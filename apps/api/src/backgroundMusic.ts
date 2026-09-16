const ALLOWED_MIME_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav", "audio/x-wav"]);
// A ~60-90 second music clip encoded at a reasonable bitrate fits
// comfortably under this — bigger than #64's 5MB voice-intro cap since a
// music clip runs longer than a 30-second spoken intro, but still a real
// server-side security boundary rather than an unbounded upload.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_TITLE_LENGTH = 80;

export interface StoredBackgroundMusic {
  author: string;
  title: string;
  mimeType: string;
  data: Buffer;
  createdAt: string;
}

export type UploadBackgroundMusicResult = { success: true } | { success: false; error: string };

/**
 * Hinge's real "Ability to add background music to the profile" (#251) —
 * one track per profile, same one-clip-per-author, replace-on-reupload
 * shape as #64's VoiceIntroStore, but for an actual uploaded audio file
 * (an existing song clip the profile owner already has) rather than a
 * fresh MediaRecorder mic capture — this app has no licensed streaming
 * catalog to pull real songs from, so "background music" is honestly
 * scoped to a clip the user supplies themselves, not a fabricated Spotify
 * playback integration (distinct from #77's SpotifyInfoStore, which only
 * ever stores track *metadata*, never audio). An optional title labels
 * what's playing, since — unlike a voice intro — a music clip usually
 * has a name worth showing.
 */
export class BackgroundMusicStore {
  private tracksByAuthor = new Map<string, StoredBackgroundMusic>();

  upload(author: unknown, mimeType: unknown, base64Data: unknown, title?: unknown): UploadBackgroundMusicResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const mime = typeof mimeType === "string" ? mimeType : "";
    const base64 = typeof base64Data === "string" ? base64Data : "";
    const trackTitle = typeof title === "string" ? title.trim().slice(0, MAX_TITLE_LENGTH) : "";

    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return { success: false, error: "mimeType must be audio/mpeg, audio/mp4, audio/ogg, audio/webm, or audio/wav" };
    }
    if (!base64) {
      return { success: false, error: "data is required" };
    }

    let data: Buffer;
    try {
      data = Buffer.from(base64, "base64");
    } catch {
      return { success: false, error: "data must be valid base64" };
    }
    if (data.length === 0) {
      return { success: false, error: "data must be valid base64" };
    }
    if (data.length > MAX_AUDIO_BYTES) {
      return { success: false, error: `Background music exceeds the ${MAX_AUDIO_BYTES / (1024 * 1024)}MB size limit` };
    }

    this.tracksByAuthor.set(authorName, { author: authorName, title: trackTitle, mimeType: mime, data, createdAt: new Date().toISOString() });
    return { success: true };
  }

  get(author: string): StoredBackgroundMusic | undefined {
    return this.tracksByAuthor.get(author);
  }

  remove(author: string): boolean {
    return this.tracksByAuthor.delete(author);
  }
}
