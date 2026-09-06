const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export interface StoredPhoto {
  id: string;
  author: string;
  mimeType: string;
  data: Buffer;
  createdAt: string;
}

export type UploadPhotoResult = { success: true; photo: StoredPhoto } | { success: false; error: string };

export class PhotoStore {
  private photos = new Map<string, StoredPhoto>();
  private nextId = 1;

  upload(author: unknown, mimeType: unknown, base64Data: unknown): UploadPhotoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const mime = typeof mimeType === "string" ? mimeType : "";
    const base64 = typeof base64Data === "string" ? base64Data : "";

    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return { success: false, error: "mimeType must be image/jpeg, image/png, or image/webp" };
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
    if (data.length > MAX_PHOTO_BYTES) {
      return { success: false, error: "Photo exceeds the 5MB size limit" };
    }

    const photo: StoredPhoto = {
      id: String(this.nextId++),
      author: authorName,
      mimeType: mime,
      data,
      createdAt: new Date().toISOString(),
    };
    this.photos.set(photo.id, photo);
    return { success: true, photo };
  }

  get(id: string): StoredPhoto | undefined {
    return this.photos.get(id);
  }
}
