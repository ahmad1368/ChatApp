import { authenticator } from "otplib";
import QRCode from "qrcode";

const ISSUER = "ChatApp";
const MAX_VERIFY_ATTEMPTS = 5;

interface TwoFactorRecord {
  secret: string;
  enabled: boolean;
  failedAttempts: number;
}

export interface SetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/**
 * TOTP (RFC 6238) — the only 2FA mechanism here that's fully self-contained.
 * Unlike SMS-based 2FA, it needs no third-party provider/credentials: the
 * secret is shared once (via QR code) with any standard authenticator app
 * (Google Authenticator, 1Password, Authy, ...), and codes are verified
 * locally against the time-based algorithm.
 */
export class TwoFactorService {
  private recordsByUserId = new Map<string, TwoFactorRecord>();

  async beginSetup(userId: string, accountLabel: string): Promise<SetupResult> {
    const secret = authenticator.generateSecret();
    this.recordsByUserId.set(userId, { secret, enabled: false, failedAttempts: 0 });

    const otpauthUrl = authenticator.keyuri(accountLabel, ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /** Confirms the user's authenticator app is actually working before 2FA
   * becomes mandatory for them — enabling it on an untested secret would
   * lock them out. */
  confirmSetup(userId: string, token: string): boolean {
    const record = this.recordsByUserId.get(userId);
    if (!record) return false;
    if (!authenticator.check(token, record.secret)) return false;
    record.enabled = true;
    record.failedAttempts = 0;
    return true;
  }

  isEnabled(userId: string): boolean {
    return this.recordsByUserId.get(userId)?.enabled ?? false;
  }

  /** Verifies a code at login time. Locks further attempts for this user
   * after too many wrong guesses, rather than allowing unlimited brute
   * force against a 6-digit code. */
  verify(userId: string, token: string): boolean {
    const record = this.recordsByUserId.get(userId);
    if (!record || !record.enabled) return false;
    if (record.failedAttempts >= MAX_VERIFY_ATTEMPTS) return false;

    const valid = authenticator.check(token, record.secret);
    record.failedAttempts = valid ? 0 : record.failedAttempts + 1;
    return valid;
  }

  disable(userId: string): void {
    this.recordsByUserId.delete(userId);
  }
}
