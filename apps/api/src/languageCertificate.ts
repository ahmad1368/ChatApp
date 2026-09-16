export const CERTIFICATE_EXAM_TYPES = ["IELTS", "TOEFL"] as const;
export type CertificateExamType = (typeof CERTIFICATE_EXAM_TYPES)[number];

export const CERTIFICATE_STATUSES = ["pending", "approved", "rejected"] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;
const MAX_SCORE_LENGTH = 20;

interface StoredCertificate {
  examType: CertificateExamType;
  score: string;
  mimeType: string;
  data: Buffer;
  submittedAt: string;
  status: CertificateStatus;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface CertificateQueueEntry {
  author: string;
  examType: CertificateExamType;
  score: string;
  submittedAt: string;
}

export interface CertificateStatusView {
  status: CertificateStatus;
  examType: CertificateExamType;
  score: string;
}

export type SubmitCertificateResult = { success: true } | { success: false; error: string };
export type ReviewCertificateResult = { success: true; status: CertificateStatus } | { success: false; error: string };

function isCertificateExamType(value: unknown): value is CertificateExamType {
  return typeof value === "string" && (CERTIFICATE_EXAM_TYPES as readonly string[]).includes(value);
}

function isReviewDecision(value: unknown): value is "approved" | "rejected" {
  return value === "approved" || value === "rejected";
}

/**
 * Raya's real "Ability to upload official language certificates
 * (IELTS/TOEFL)" (#324) — scoped like #174's photo verification: this
 * app has no real integration with IELTS/ETS's official results-
 * verification services (neither has credentials in this environment),
 * so a submission doesn't auto-grant a "verified" badge — it starts
 * `pending` and only becomes `approved` once an admin has actually
 * looked at the uploaded document via `review()`. The raw certificate
 * file is never served through any user-facing route, only through the
 * admin-key-gated review endpoints (see server.ts).
 */
export class LanguageCertificateStore {
  private certsByAuthor = new Map<string, StoredCertificate>();

  submit(author: unknown, examType: unknown, score: unknown, mimeType: unknown, base64Data: unknown): SubmitCertificateResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!isCertificateExamType(examType)) {
      return { success: false, error: `examType must be one of: ${CERTIFICATE_EXAM_TYPES.join(", ")}` };
    }
    const scoreText = typeof score === "string" ? score.trim() : "";
    if (!scoreText) {
      return { success: false, error: "score is required" };
    }
    if (scoreText.length > MAX_SCORE_LENGTH) {
      return { success: false, error: `score must be ${MAX_SCORE_LENGTH} characters or fewer` };
    }
    if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
      return { success: false, error: "mimeType must be image/jpeg, image/png, image/webp, or application/pdf" };
    }

    let data: Buffer;
    try {
      data = Buffer.from(typeof base64Data === "string" ? base64Data : "", "base64");
    } catch {
      return { success: false, error: "Invalid base64 data" };
    }
    if (data.byteLength === 0) return { success: false, error: "Empty certificate data" };
    if (data.byteLength > MAX_CERTIFICATE_BYTES) {
      return { success: false, error: `Certificate exceeds the ${MAX_CERTIFICATE_BYTES / (1024 * 1024)}MB limit` };
    }

    this.certsByAuthor.set(authorName, {
      examType,
      score: scoreText,
      mimeType,
      data,
      submittedAt: new Date().toISOString(),
      status: "pending",
    });
    return { success: true };
  }

  isVerified(author: string): boolean {
    return this.certsByAuthor.get(author)?.status === "approved";
  }

  getStatus(author: string): CertificateStatusView | null {
    const cert = this.certsByAuthor.get(author);
    return cert ? { status: cert.status, examType: cert.examType, score: cert.score } : null;
  }

  /** Every submission still awaiting a decision, oldest first — a real FIFO moderation queue, same shape as verification.ts's. */
  getPendingQueue(): CertificateQueueEntry[] {
    return [...this.certsByAuthor.entries()]
      .filter(([, cert]) => cert.status === "pending")
      .map(([author, cert]) => ({ author, examType: cert.examType, score: cert.score, submittedAt: cert.submittedAt }))
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  }

  review(author: unknown, reviewer: unknown, status: unknown): ReviewCertificateResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const reviewerName = typeof reviewer === "string" ? reviewer.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!reviewerName) {
      return { success: false, error: "reviewer is required" };
    }
    if (!isReviewDecision(status)) {
      return { success: false, error: "status must be 'approved' or 'rejected'" };
    }
    const cert = this.certsByAuthor.get(authorName);
    if (!cert) {
      return { success: false, error: "No certificate submission found for this author" };
    }

    cert.status = status;
    cert.reviewedAt = new Date().toISOString();
    cert.reviewedBy = reviewerName;
    return { success: true, status };
  }

  /** Admin-only: the raw uploaded certificate, for visual review — never exposed through any user-facing route. */
  getCertificateForReview(author: string): { mimeType: string; data: Buffer } | undefined {
    const cert = this.certsByAuthor.get(author);
    return cert ? { mimeType: cert.mimeType, data: cert.data } : undefined;
  }
}
