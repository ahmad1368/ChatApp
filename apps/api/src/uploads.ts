import { randomUUID } from "crypto";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB, post-crop/compression this is generous
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface StoredUpload {
  mimeType: string;
  data: Buffer;
}

export type SaveUploadResult = { id: string; error?: undefined } | { id?: undefined; error: string };

export class UploadStore {
  private uploads = new Map<string, StoredUpload>();

  save(mimeType: string, base64Data: string): SaveUploadResult {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return { error: `Unsupported image type: ${mimeType}` };
    }

    let data: Buffer;
    try {
      data = Buffer.from(base64Data, "base64");
    } catch {
      return { error: "Invalid base64 data" };
    }
    if (data.byteLength === 0) {
      return { error: "Empty image data" };
    }
    if (data.byteLength > MAX_UPLOAD_BYTES) {
      return { error: "Image exceeds the 5MB limit" };
    }

    const id = randomUUID();
    this.uploads.set(id, { mimeType, data });
    return { id };
  }

  get(id: string): StoredUpload | undefined {
    return this.uploads.get(id);
  }
}
