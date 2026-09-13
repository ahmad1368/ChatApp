import { createHmac, randomUUID, timingSafeEqual } from "crypto";

const MAX_DESCRIPTION_LENGTH = 200;

export type ChargeStatus = "pending" | "confirmed" | "failed";

export interface CryptoCharge {
  id: string;
  author: string;
  amountCents: number;
  description: string;
  status: ChargeStatus;
  createdAt: string;
}

export type CreateChargeResult = { success: true; charge: CryptoCharge } | { success: false; error: string };

/** A shared webhook secret an operator sets in .env — same fail-closed default (503 when unset) as ADMIN_API_KEY. */
export function isCoinbaseWebhookConfigured(): boolean {
  return Boolean(process.env.COINBASE_COMMERCE_WEBHOOK_SECRET);
}

/**
 * Real Coinbase Commerce webhook signature verification: HMAC-SHA256 of
 * the raw request body using the shared webhook secret, compared to the
 * X-CC-Webhook-Signature header — exactly Coinbase's own documented
 * scheme (commerce.coinbase.com docs, "Securing webhooks"). Requires the
 * *raw* body bytes (see server.ts's express.json() verify callback) since
 * re-serializing the parsed JSON isn't guaranteed to match what Coinbase
 * actually signed.
 */
export function verifyCoinbaseWebhookSignature(rawBody: string, signatureHeader: unknown): boolean {
  if (!isCoinbaseWebhookConfigured() || typeof signatureHeader !== "string" || !/^[0-9a-f]+$/i.test(signatureHeader)) {
    return false;
  }
  const expectedHex = createHmac("sha256", process.env.COINBASE_COMMERCE_WEBHOOK_SECRET!).update(rawBody).digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(signatureHeader, "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/**
 * Tinder's real "Cryptocurrency payment" (#195). A real gateway
 * (Coinbase Commerce, BitPay, etc.) actually generating a live deposit
 * address and converting to crypto at a real-time exchange rate needs a
 * merchant account this environment has no credentials for — same
 * disclosed gap as #192's card/bank gateway. What's real and fully
 * testable without one: the charge lifecycle this app's own backend
 * needs regardless of gateway, and — unlike the mobile IAP bridges
 * (#193/#194), which can't verify their webhook's signature at all
 * without live platform certificates — Coinbase Commerce's webhook
 * signature scheme is a self-contained HMAC-SHA256 check this app can
 * genuinely perform and prove correct (see verifyCoinbaseWebhookSignature
 * above), gated the same fail-closed way as ADMIN_API_KEY.
 */
export class CryptoChargeStore {
  private byId = new Map<string, CryptoCharge>();

  create(author: unknown, amountCents: unknown, description: unknown): CreateChargeResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (typeof amountCents !== "number" || !Number.isFinite(amountCents) || !Number.isInteger(amountCents) || amountCents <= 0) {
      return { success: false, error: "amountCents must be a positive integer" };
    }
    const descriptionText = typeof description === "string" ? description.trim() : "";
    if (!descriptionText) return { success: false, error: "description is required" };
    if (descriptionText.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, error: `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` };
    }

    const charge: CryptoCharge = {
      id: randomUUID(),
      author: authorText,
      amountCents,
      description: descriptionText,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.byId.set(charge.id, charge);
    return { success: true, charge };
  }

  get(chargeId: string): CryptoCharge | undefined {
    return this.byId.get(chargeId);
  }

  /** Only a still-pending charge can resolve — a charge already confirmed/failed keeps its final status. */
  markConfirmed(chargeId: string): boolean {
    const charge = this.byId.get(chargeId);
    if (!charge || charge.status !== "pending") return false;
    charge.status = "confirmed";
    return true;
  }

  markFailed(chargeId: string): boolean {
    const charge = this.byId.get(chargeId);
    if (!charge || charge.status !== "pending") return false;
    charge.status = "failed";
    return true;
  }
}
