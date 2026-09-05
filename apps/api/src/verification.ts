const MAX_SELFIE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface StoredSelfie {
  mimeType: string;
  data: Buffer;
  verifiedAt: string;
}

export type SaveSelfieResult = { success: true } | { success: false; error: string };

export class VerificationStore {
  private selfiesByUserId = new Map<string, StoredSelfie>();

  saveSelfie(userId: string, mimeType: string, base64Data: string): SaveSelfieResult {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return { success: false, error: `Unsupported image type: ${mimeType}` };
    }

    let data: Buffer;
    try {
      data = Buffer.from(base64Data, "base64");
    } catch {
      return { success: false, error: "Invalid base64 data" };
    }
    if (data.byteLength === 0) return { success: false, error: "Empty image data" };
    if (data.byteLength > MAX_SELFIE_BYTES) return { success: false, error: "Image exceeds the 5MB limit" };

    this.selfiesByUserId.set(userId, { mimeType, data, verifiedAt: new Date().toISOString() });
    return { success: true };
  }

  isVerified(userId: string): boolean {
    return this.selfiesByUserId.has(userId);
  }
}
