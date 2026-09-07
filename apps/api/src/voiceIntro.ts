const ALLOWED_MIME_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"]);
// 30 seconds of compressed voice audio fits comfortably well under this;
// this is the real server-side security boundary, same as #63's video cap.
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export interface StoredVoiceIntro {
  author: string;
  mimeType: string;
  data: Buffer;
  createdAt: string;
}

export type UploadVoiceIntroResult = { success: true } | { success: false; error: string };

/**
 * One short voice-intro recording per profile — Hinge's real voice-prompt
 * feature. Same shape as #63's IntroVideoStore (one clip per author,
 * replace-on-reupload), just audio mime types and a smaller size cap.
 */
export class VoiceIntroStore {
  private clipsByAuthor = new Map<string, StoredVoiceIntro>();

  upload(author: unknown, mimeType: unknown, base64Data: unknown): UploadVoiceIntroResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const mime = typeof mimeType === "string" ? mimeType : "";
    const base64 = typeof base64Data === "string" ? base64Data : "";

    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return { success: false, error: "mimeType must be audio/webm, audio/mp4, audio/mpeg, or audio/ogg" };
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
      return { success: false, error: `Voice intro exceeds the ${MAX_AUDIO_BYTES / (1024 * 1024)}MB size limit` };
    }

    this.clipsByAuthor.set(authorName, { author: authorName, mimeType: mime, data, createdAt: new Date().toISOString() });
    return { success: true };
  }

  get(author: string): StoredVoiceIntro | undefined {
    return this.clipsByAuthor.get(author);
  }

  remove(author: string): boolean {
    return this.clipsByAuthor.delete(author);
  }
}
