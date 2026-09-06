const MAX_SELFIE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface StoredSelfie {
  mimeType: string;
  data: Buffer;
  verifiedAt: string;
}

export type SaveSelfieResult = { success: true } | { success: false; error: string };

/**
 * Live selfie verification, scoped to what's honestly achievable without a
 * dedicated ID-verification vendor (Persona, Jumio, Onfido) or a face-
 * embedding/recognition model — neither of which this environment has
 * credentials or infra for, same reasoning as the OAuth providers' stubbed
 * SMS/email delivery.
 *
 * What IS real here: the client only accepts a frame captured live from
 * getUserMedia (never a picked file), and apps/web's faceDetection.ts
 * (from #35) confirms a face is actually present before the frame is
 * accepted as a submission. True liveness (anti-spoofing against a held-up
 * photo or video replay) and automated face-match against the profile
 * photo are NOT implemented — that gap is called out here rather than
 * silently claimed as covered.
 *
 * Privacy: the selfie itself is stored but never served back through any
 * endpoint in this codebase — only a boolean "verified" flag is ever
 * exposed to clients (via OnboardingProfile.isSelfieVerified). A real
 * deployment would still need a moderation/review pipeline before treating
 * "verified" as a trust signal shown to other users.
 */
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
