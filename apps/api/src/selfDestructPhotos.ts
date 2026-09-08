import { randomUUID } from "crypto";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface StoredSelfDestructPhoto {
  author: string;
  mimeType: string;
  data: Buffer;
}

export type SavePhotoResult = { success: true; id: string } | { success: false; error: string };

/**
 * Bumble/Snapchat-style "view once, then gone" chat photo (#123) — its
 * own store rather than extending uploads.ts's UploadStore, since a
 * regular chat image is meant to stay viewable forever while this one is
 * destroyed by the act of viewing it.
 *
 * The sender is recorded at save time so their own chat bubble can keep
 * re-viewing what they sent (real Snapchat/Bumble never destroy a photo
 * for its own sender) — everyone else destroys it the first time
 * `view()` is called for them. There's no separate "mark as read" step:
 * the view *is* the read, same as the real feature.
 */
export class SelfDestructPhotoStore {
  private photos = new Map<string, StoredSelfDestructPhoto>();
  private viewedIds = new Set<string>();

  save(author: unknown, mimeType: unknown, base64Data: unknown): SavePhotoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    const mime = typeof mimeType === "string" ? mimeType : "";
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return { success: false, error: `Unsupported image type: ${mime}` };
    }

    const base64 = typeof base64Data === "string" ? base64Data : "";
    let data: Buffer;
    try {
      data = Buffer.from(base64, "base64");
    } catch {
      return { success: false, error: "Invalid base64 data" };
    }
    if (data.byteLength === 0) {
      return { success: false, error: "Empty image data" };
    }
    if (data.byteLength > MAX_PHOTO_BYTES) {
      return { success: false, error: "Image exceeds the 5MB limit" };
    }

    const id = randomUUID();
    this.photos.set(id, { author: authorName, mimeType: mime, data });
    return { success: true, id };
  }

  /**
   * Returns the photo if it's still available to `viewer`. The sender can
   * view it any number of times; anyone else destroys it on this call —
   * it will never be returned again to any viewer afterward.
   */
  view(id: string, viewer: string): { mimeType: string; data: Buffer } | undefined {
    const photo = this.photos.get(id);
    if (!photo) return undefined;
    if (viewer === photo.author) {
      return { mimeType: photo.mimeType, data: photo.data };
    }
    this.photos.delete(id);
    this.viewedIds.add(id);
    return { mimeType: photo.mimeType, data: photo.data };
  }

  /** Whether this id was ever fully consumed (for a clearer 410 vs 404 distinction). */
  hasBeenViewed(id: string): boolean {
    return this.viewedIds.has(id);
  }
}
