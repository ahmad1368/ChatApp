import crypto from "crypto";

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const EDU_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.edu(\.[a-z]{2})?$/i;

export function isUniversityEmail(raw: unknown): raw is string {
  return typeof raw === "string" && EDU_EMAIL_PATTERN.test(raw.trim());
}

interface PendingEntry {
  email: string;
  code: string;
  expiresAt: number;
  attemptsRemaining: number;
  lastSentAt: number;
}

interface VerifiedEntry {
  email: string;
  verifiedAt: string;
}

export interface StudentVerificationStatus {
  verified: boolean;
  email?: string;
}

export type RequestVerificationResult = { success: true; code: string } | { success: false; error: string };
export type ConfirmVerificationResult = { success: true } | { success: false; error: string };

/**
 * Raya's real "Student verification system via university (.edu) email"
 * (#305) — scoped to what's honestly checkable without a paid verification
 * vendor (SheerID, UNiDAYS), which this environment has no credentials for:
 * a real one-time code sent to an address that must match a `.edu` (or
 * `.edu.xx`) suffix, the same real-but-simple signal services without a
 * university directory integration actually rely on. This does NOT confirm
 * current enrollment or a specific institution roster — that gap is
 * disclosed here rather than silently claimed as covered.
 *
 * Code delivery mirrors #21/#47's phone-OTP and #157's `RecoveryCodeService`
 * stand-in: a real deployment sends `code` via an email provider (SES,
 * SendGrid, etc.) which needs credentials this environment doesn't have, so
 * the route handler logs it server-side instead of emailing it.
 */
export class StudentVerificationStore {
  private pendingByAuthor = new Map<string, PendingEntry>();
  private verifiedByAuthor = new Map<string, VerifiedEntry>();

  requestVerification(author: string, email: unknown): RequestVerificationResult {
    if (!isUniversityEmail(email)) {
      return { success: false, error: "A valid university (.edu) email address is required" };
    }

    const normalized = (email as string).trim().toLowerCase();
    const now = Date.now();
    const existing = this.pendingByAuthor.get(author);
    if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      return { success: false, error: "Please wait before requesting another code" };
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    this.pendingByAuthor.set(author, {
      email: normalized,
      code,
      expiresAt: now + CODE_TTL_MS,
      attemptsRemaining: MAX_ATTEMPTS,
      lastSentAt: now,
    });
    return { success: true, code };
  }

  confirmVerification(author: string, code: unknown): ConfirmVerificationResult {
    const entry = this.pendingByAuthor.get(author);
    if (!entry) {
      return { success: false, error: "No pending verification for this profile" };
    }
    if (Date.now() > entry.expiresAt) {
      this.pendingByAuthor.delete(author);
      return { success: false, error: "Code expired — request a new one" };
    }
    if (entry.attemptsRemaining <= 0) {
      this.pendingByAuthor.delete(author);
      return { success: false, error: "Too many incorrect attempts — request a new one" };
    }
    if (typeof code !== "string" || code !== entry.code) {
      entry.attemptsRemaining -= 1;
      return { success: false, error: "Incorrect code" };
    }

    this.pendingByAuthor.delete(author);
    this.verifiedByAuthor.set(author, { email: entry.email, verifiedAt: new Date().toISOString() });
    return { success: true };
  }

  isVerified(author: string): boolean {
    return this.verifiedByAuthor.has(author);
  }

  getStatus(author: string): StudentVerificationStatus {
    const verified = this.verifiedByAuthor.get(author);
    return verified ? { verified: true, email: verified.email } : { verified: false };
  }
}
