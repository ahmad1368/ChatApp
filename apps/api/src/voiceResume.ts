const ALLOWED_MIME_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"]);
// A resume needs real room to cover job/education/skills — well beyond
// #64's 30-second casual voice intro — so this cap is sized for a longer
// clip (see VoiceResumeRecorder.tsx's 2-minute client-side duration cap),
// same real server-side security boundary as #63's video cap.
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export interface StoredVoiceResume {
  author: string;
  mimeType: string;
  data: Buffer;
  createdAt: string;
}

export type UploadVoiceResumeResult = { success: true } | { success: false; error: string };

/**
 * Match.com's real "Ability to add a voice resume" (#319) — a spoken
 * summary of career background/experience, distinct from #64's
 * VoiceIntroStore (a short, casual, playful voice-prompt clip): same
 * one-per-profile, replace-on-reupload shape, but its own store/route
 * namespace, a longer allowed duration/size, and surfaced alongside
 * #67's job info and #68's education info rather than near the casual
 * intro, matching Match.com's serious/professional profile framing.
 */
export class VoiceResumeStore {
  private clipsByAuthor = new Map<string, StoredVoiceResume>();

  upload(author: unknown, mimeType: unknown, base64Data: unknown): UploadVoiceResumeResult {
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
      return { success: false, error: `Voice resume exceeds the ${MAX_AUDIO_BYTES / (1024 * 1024)}MB size limit` };
    }

    this.clipsByAuthor.set(authorName, { author: authorName, mimeType: mime, data, createdAt: new Date().toISOString() });
    return { success: true };
  }

  get(author: string): StoredVoiceResume | undefined {
    return this.clipsByAuthor.get(author);
  }

  remove(author: string): boolean {
    return this.clipsByAuthor.delete(author);
  }
}
