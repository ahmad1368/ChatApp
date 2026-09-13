import { randomUUID } from "crypto";

export const PAYMENT_METHOD_TYPES = ["card", "bank"] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

const MAX_BRAND_LENGTH = 30;
const LAST4_PATTERN = /^\d{4}$/;

export interface PaymentMethod {
  id: string;
  author: string;
  type: PaymentMethodType;
  brand: string;
  last4: string;
  isDefault: boolean;
  addedAt: string;
}

export type AddPaymentMethodResult = { success: true; method: PaymentMethod } | { success: false; error: string };

function isPaymentMethodType(value: unknown): value is PaymentMethodType {
  return typeof value === "string" && (PAYMENT_METHOD_TYPES as readonly string[]).includes(value);
}

/**
 * Raya's real "In-app credit/bank payment gateway" (#192). A real
 * charge network call (Stripe, Plaid, etc.) needs a payment processor
 * this environment has no credentials for — same disclosed gap as
 * pricingPlans.ts, subscriptions.ts, and transactionLog.ts. What's
 * real and safe to build without one: a payment-method-on-file record,
 * the same shape a real gateway integration would already be limited
 * to server-side (Stripe Elements/a bank's Plaid Link tokenizes the
 * raw card/account number in the client or at the processor — a
 * server never receives or stores the full PAN or routing number even
 * in a real integration). This store only ever holds a brand label and
 * last 4 digits, never a full number — there's no unsafe raw-PAN
 * capture to "honestly disclose around" here, only a genuine charge
 * network call to disclose as out of scope.
 */
export class PaymentMethodStore {
  private methodsByAuthor = new Map<string, PaymentMethod[]>();

  add(author: unknown, type: unknown, brand: unknown, last4: unknown): AddPaymentMethodResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (!isPaymentMethodType(type)) return { success: false, error: `type must be one of: ${PAYMENT_METHOD_TYPES.join(", ")}` };
    const brandText = typeof brand === "string" ? brand.trim() : "";
    if (!brandText) return { success: false, error: "brand is required" };
    if (brandText.length > MAX_BRAND_LENGTH) return { success: false, error: `brand must be ${MAX_BRAND_LENGTH} characters or fewer` };
    if (typeof last4 !== "string" || !LAST4_PATTERN.test(last4)) return { success: false, error: "last4 must be exactly 4 digits" };

    const existing = this.methodsByAuthor.get(authorText) ?? [];
    const method: PaymentMethod = {
      id: randomUUID(),
      author: authorText,
      type,
      brand: brandText,
      last4,
      isDefault: existing.length === 0,
      addedAt: new Date().toISOString(),
    };
    this.methodsByAuthor.set(authorText, [...existing, method]);
    return { success: true, method };
  }

  remove(author: string, methodId: string): boolean {
    const existing = this.methodsByAuthor.get(author);
    if (!existing) return false;
    const removed = existing.find((m) => m.id === methodId);
    if (!removed) return false;

    const remaining = existing.filter((m) => m.id !== methodId);
    if (removed.isDefault && remaining.length > 0) remaining[0].isDefault = true;
    this.methodsByAuthor.set(author, remaining);
    return true;
  }

  setDefault(author: string, methodId: string): boolean {
    const existing = this.methodsByAuthor.get(author);
    if (!existing?.some((m) => m.id === methodId)) return false;
    for (const method of existing) method.isDefault = method.id === methodId;
    return true;
  }

  list(author: string): PaymentMethod[] {
    return this.methodsByAuthor.get(author) ?? [];
  }
}
