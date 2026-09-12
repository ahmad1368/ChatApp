export const VERIFICATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

const MAX_SELFIE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface StoredSelfie {
  mimeType: string;
  data: Buffer;
  submittedAt: string;
  status: VerificationStatus;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface VerificationQueueEntry {
  userId: string;
  submittedAt: string;
}

export type SaveSelfieResult = { success: true } | { success: false; error: string };
export type ReviewVerificationResult = { success: true; status: VerificationStatus } | { success: false; error: string };

function isReviewDecision(value: unknown): value is "approved" | "rejected" {
  return value === "approved" || value === "rejected";
}

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
 * #174 closes the gap this doc comment used to end on ("a real deployment
 * would still need a moderation/review pipeline before treating 'verified'
 * as a trust signal"): a submission now starts `pending` and `isVerified()`
 * only returns true once an admin has explicitly approved it via
 * `review()` — no more auto-granting the badge the instant a selfie is
 * uploaded. Privacy stays intact for everyone except that review step: the
 * raw selfie is still never served through any user-facing endpoint, only
 * through the new admin-key-gated `getSelfieForReview()` (see server.ts's
 * GET /api/admin/verification-queue/:userId/selfie) — an admin approving a
 * badge blind, with no way to actually look at the photo, wouldn't be a
 * real review at all.
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

    this.selfiesByUserId.set(userId, { mimeType, data, submittedAt: new Date().toISOString(), status: "pending" });
    return { success: true };
  }

  isVerified(userId: string): boolean {
    return this.selfiesByUserId.get(userId)?.status === "approved";
  }

  getStatus(userId: string): VerificationStatus | null {
    return this.selfiesByUserId.get(userId)?.status ?? null;
  }

  /** Every submission still awaiting a decision, oldest first — a real FIFO moderation queue. */
  getPendingQueue(): VerificationQueueEntry[] {
    return [...this.selfiesByUserId.entries()]
      .filter(([, selfie]) => selfie.status === "pending")
      .map(([userId, selfie]) => ({ userId, submittedAt: selfie.submittedAt }))
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  }

  review(userId: unknown, reviewer: unknown, status: unknown): ReviewVerificationResult {
    const id = typeof userId === "string" ? userId.trim() : "";
    const reviewerName = typeof reviewer === "string" ? reviewer.trim() : "";
    if (!id) {
      return { success: false, error: "userId is required" };
    }
    if (!reviewerName) {
      return { success: false, error: "reviewer is required" };
    }
    if (!isReviewDecision(status)) {
      return { success: false, error: "status must be 'approved' or 'rejected'" };
    }
    const selfie = this.selfiesByUserId.get(id);
    if (!selfie) {
      return { success: false, error: "No selfie submission found for this user" };
    }

    selfie.status = status;
    selfie.reviewedAt = new Date().toISOString();
    selfie.reviewedBy = reviewerName;
    return { success: true, status };
  }

  /** Admin-only: the raw submitted selfie, for visual comparison during review — never exposed through any user-facing route. */
  getSelfieForReview(userId: string): { mimeType: string; data: Buffer } | undefined {
    const selfie = this.selfiesByUserId.get(userId);
    return selfie ? { mimeType: selfie.mimeType, data: selfie.data } : undefined;
  }
}
