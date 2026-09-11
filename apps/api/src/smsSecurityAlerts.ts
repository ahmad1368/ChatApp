export type SecurityAlertCategory = "login" | "accountSecurity";

const CATEGORIES: readonly SecurityAlertCategory[] = ["login", "accountSecurity"];

export type SecurityAlertPreferences = Record<SecurityAlertCategory, boolean>;

export interface SmsAlertRecord {
  category: SecurityAlertCategory;
  message: string;
  phoneNumber: string;
  sentAt: string;
}

export type SetPreferenceResult = { success: true } | { success: false; error: string };

/**
 * Bumble/Tinder-style SMS notifications for logins and account-security-
 * lowering events (2FA disabled, other devices logged out) — #158. Same
 * stubbed-delivery pattern as auth.ts's OtpService and sos.ts's contact
 * notifications: no real SMS provider (Twilio, etc.) has credentials in
 * this environment, so "sending" means logging the message and recording
 * it here so a client/test can verify what would have gone out.
 *
 * Per-category preferences, per the issue's implementation guide ("store
 * per-category user preferences and enforce them at send time"): a user
 * who mutes "login" alerts still gets "accountSecurity" ones and vice
 * versa. Both default on — safety notifications are opt-out, not opt-in,
 * same stance as this app's other safety features (SOS, blocking).
 */
export class SmsSecurityAlertStore {
  private preferencesByUserId = new Map<string, SecurityAlertPreferences>();
  private alertsByUserId = new Map<string, SmsAlertRecord[]>();

  private preferencesFor(userId: string): SecurityAlertPreferences {
    return this.preferencesByUserId.get(userId) ?? { login: true, accountSecurity: true };
  }

  getPreferences(userId: string): SecurityAlertPreferences {
    return this.preferencesFor(userId);
  }

  setPreference(userId: unknown, category: unknown, enabled: unknown): SetPreferenceResult {
    const userIdStr = typeof userId === "string" ? userId.trim() : "";
    if (!userIdStr) return { success: false, error: "userId is required" };
    if (!CATEGORIES.includes(category as SecurityAlertCategory)) {
      return { success: false, error: `category must be one of: ${CATEGORIES.join(", ")}` };
    }
    if (typeof enabled !== "boolean") {
      return { success: false, error: "enabled must be a boolean" };
    }

    this.preferencesByUserId.set(userIdStr, {
      ...this.preferencesFor(userIdStr),
      [category as SecurityAlertCategory]: enabled,
    });
    return { success: true };
  }

  /**
   * Returns whether the alert was actually sent — false when the user has
   * no phone on file (Google/Apple/Facebook/email-recovery accounts don't
   * necessarily have one) or has opted out of this category.
   */
  notify(userId: string, phoneNumber: string | undefined, category: SecurityAlertCategory, message: string): boolean {
    if (!phoneNumber) return false;
    if (!this.preferencesFor(userId)[category]) return false;

    const record: SmsAlertRecord = { category, message, phoneNumber, sentAt: new Date().toISOString() };
    const existing = this.alertsByUserId.get(userId) ?? [];
    existing.push(record);
    this.alertsByUserId.set(userId, existing);

    // Stand-in for a real SMS provider (Twilio, etc.) — same pattern as
    // auth.ts's OtpService and sos.ts's stubbed contact notifications.
    console.log(`[sms-security-alert] ${phoneNumber}: ${message}`);
    return true;
  }

  getSentAlerts(userId: string): SmsAlertRecord[] {
    return this.alertsByUserId.get(userId) ?? [];
  }
}
