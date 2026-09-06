import crypto from "crypto";

const CODE_TTL_MS = 15 * 60 * 1000; // longer than a login OTP: recovery emails can sit unread
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().toLowerCase();
  return EMAIL_PATTERN.test(trimmed) ? trimmed : undefined;
}

interface CodeEntry {
  code: string;
  expiresAt: number;
  attemptsRemaining: number;
  lastSentAt: number;
}

export type RequestCodeResult = { code: string } | { error: "cooldown"; retryAfterMs: number };
export type VerifyCodeResult = { success: true } | { success: false; error: "invalid" | "expired" | "too_many_attempts" };

/**
 * Account recovery for a passwordless app: this repo has no passwords to
 * reset (signup is phone/OTP or an OAuth-style provider — see #21-#24), so
 * "password recovery" is implemented as its closest real equivalent: an
 * email-based access-recovery code, for when a user can no longer complete
 * phone verification (lost/changed number). SMS-based recovery is already
 * covered by #21's phone OTP re-verification — there is no separate
 * password to forget on that path either.
 *
 * A real deployment sends `code` via an email provider (SES, SendGrid,
 * etc.) — that needs credentials this environment doesn't have, so the
 * route handler logs it server-side instead, same stand-in used for SMS
 * delivery in #21.
 */
export class RecoveryCodeService {
  private entries = new Map<string, CodeEntry>();

  requestCode(identifier: string): RequestCodeResult {
    const now = Date.now();
    const existing = this.entries.get(identifier);
    if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      return { error: "cooldown", retryAfterMs: RESEND_COOLDOWN_MS - (now - existing.lastSentAt) };
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    this.entries.set(identifier, { code, expiresAt: now + CODE_TTL_MS, attemptsRemaining: MAX_ATTEMPTS, lastSentAt: now });
    return { code };
  }

  verifyCode(identifier: string, code: string): VerifyCodeResult {
    const entry = this.entries.get(identifier);
    if (!entry) return { success: false, error: "invalid" };

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(identifier);
      return { success: false, error: "expired" };
    }
    if (entry.attemptsRemaining <= 0) {
      this.entries.delete(identifier);
      return { success: false, error: "too_many_attempts" };
    }
    if (entry.code !== code) {
      entry.attemptsRemaining -= 1;
      return { success: false, error: "invalid" };
    }

    this.entries.delete(identifier); // one-time use
    return { success: true };
  }
}
