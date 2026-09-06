const ALLOWED_MIME_TYPES = new Set(["video/mp4", "video/webm"]);
// Short clips (Hinge-style, ~15-30s) fit comfortably; this is the real
// server-side security boundary. The duration cap itself can't be checked
// here without decoding the video (a heavy dependency this app doesn't
// need) — see IntroVideoUpload.tsx for the client-side duration check.
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

export interface StoredIntroVideo {
  author: string;
  mimeType: string;
  data: Buffer;
  createdAt: string;
}

export type UploadIntroVideoResult = { success: true } | { success: false; error: string };

/**
 * One short looping intro video per profile — deliberately simpler than
 * PhotoStore (#45): no per-photo watermarking (burning a watermark into
 * every frame of a video needs a real video-processing pipeline, out of
 * scope here) and no album (#59/#61's multi-photo/access-level model is a
 * separate concept from a single profile intro clip).
 */
export class IntroVideoStore {
  private videosByAuthor = new Map<string, StoredIntroVideo>();

  upload(author: unknown, mimeType: unknown, base64Data: unknown): UploadIntroVideoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const mime = typeof mimeType === "string" ? mimeType : "";
    const base64 = typeof base64Data === "string" ? base64Data : "";

    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return { success: false, error: "mimeType must be video/mp4 or video/webm" };
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
    if (data.length > MAX_VIDEO_BYTES) {
      return { success: false, error: `Video exceeds the ${MAX_VIDEO_BYTES / (1024 * 1024)}MB size limit` };
    }

    this.videosByAuthor.set(authorName, { author: authorName, mimeType: mime, data, createdAt: new Date().toISOString() });
    return { success: true };
  }

  get(author: string): StoredIntroVideo | undefined {
    return this.videosByAuthor.get(author);
  }

  remove(author: string): boolean {
    return this.videosByAuthor.delete(author);
  }
}
