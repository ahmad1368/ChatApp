const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
// Google's own recommended threshold for reCAPTCHA v3's continuous 0.0-1.0
// risk score — below this, treat the request as likely automated.
const MIN_SCORE = 0.5;

export type RecaptchaVerifier = (token: string, secretKey: string) => Promise<boolean>;

/** Real verification: calls Google's siteverify endpoint. */
export const verifyRecaptchaToken: RecaptchaVerifier = async (token, secretKey) => {
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const body = await res.json();
    if (!body.success) return false;
    // v2 checkbox responses carry no score field; only v3's continuous score
    // needs the threshold check.
    return typeof body.score === "number" ? body.score >= MIN_SCORE : true;
  } catch {
    return false;
  }
};

/**
 * Bot detection for the phone-OTP signup flow, gating the one step that
 * costs real money to abuse (triggering an SMS send) — same real-world
 * scope as reCAPTCHA on any signup form. Gracefully degrades like #22-#24's
 * OAuth providers: unconfigured means the check is skipped, not that
 * signup breaks, since phone OTP is this app's only always-available
 * sign-in method.
 */
export class RecaptchaService {
  constructor(
    private readonly secretKey: string | undefined = process.env.RECAPTCHA_SECRET_KEY,
    private readonly verifier: RecaptchaVerifier = verifyRecaptchaToken
  ) {}

  isConfigured(): boolean {
    return Boolean(this.secretKey);
  }

  async verify(token: unknown): Promise<boolean> {
    if (!this.secretKey) return true;
    if (typeof token !== "string" || !token) return false;
    return this.verifier(token, this.secretKey);
  }
}
