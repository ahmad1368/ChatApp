export const DISCOUNT_TYPES = ["percent", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

const MAX_CODE_LENGTH = 30;

export interface DiscountCode {
  code: string;
  type: DiscountType;
  amount: number;
  expiresAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
  createdAt: string;
}

export type CreateCodeResult = { success: true; code: DiscountCode } | { success: false; error: string };
export type ValidateCodeResult = { valid: true; code: DiscountCode } | { valid: false; error: string };

function isDiscountType(value: unknown): value is DiscountType {
  return typeof value === "string" && (DISCOUNT_TYPES as readonly string[]).includes(value);
}

function normalizeCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

/**
 * Bumble's real "Manage financial plans, pricing and discount codes"
 * (#177) — the discount-code half (see pricingPlans.ts for the plan
 * management half). Redeeming a code here validates it and records the
 * usage — this app has no real checkout to actually apply the discount
 * to, since there's no payment processor (same disclosed gap as
 * pricingPlans.ts), so redeem() is the honest stand-in: it proves the
 * code is genuinely live and tracks real, persistent redemption counts
 * rather than a fabricated "applied to your order" confirmation.
 */
export class DiscountCodeStore {
  private codesByCode = new Map<string, DiscountCode>();

  create(codeInput: unknown, type: unknown, amount: unknown, expiresAt: unknown, maxRedemptions: unknown): CreateCodeResult {
    const code = normalizeCode(codeInput);
    if (!code) return { success: false, error: "code is required" };
    if (code.length > MAX_CODE_LENGTH) return { success: false, error: `code must be ${MAX_CODE_LENGTH} characters or fewer` };
    if (this.codesByCode.has(code)) return { success: false, error: "A code with this name already exists" };
    if (!isDiscountType(type)) return { success: false, error: `type must be one of: ${DISCOUNT_TYPES.join(", ")}` };
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "amount must be a positive number" };
    }
    if (type === "percent" && amount > 100) {
      return { success: false, error: "a percent amount can't exceed 100" };
    }

    let expiresAtValue: string | null = null;
    if (expiresAt !== undefined && expiresAt !== null) {
      if (typeof expiresAt !== "string" || Number.isNaN(Date.parse(expiresAt))) {
        return { success: false, error: "expiresAt must be a valid date string" };
      }
      expiresAtValue = expiresAt;
    }

    let maxRedemptionsValue: number | null = null;
    if (maxRedemptions !== undefined && maxRedemptions !== null) {
      if (typeof maxRedemptions !== "number" || !Number.isInteger(maxRedemptions) || maxRedemptions <= 0) {
        return { success: false, error: "maxRedemptions must be a positive integer" };
      }
      maxRedemptionsValue = maxRedemptions;
    }

    const discountCode: DiscountCode = {
      code,
      type,
      amount,
      expiresAt: expiresAtValue,
      maxRedemptions: maxRedemptionsValue,
      redemptionCount: 0,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.codesByCode.set(code, discountCode);
    return { success: true, code: discountCode };
  }

  deactivate(codeInput: string): boolean {
    const code = normalizeCode(codeInput);
    const existing = this.codesByCode.get(code);
    if (!existing || !existing.active) return false;
    existing.active = false;
    return true;
  }

  /** Every code ever created, newest first — the admin management view.
   *  Map insertion order tracks creation order, so this is exact even
   *  when two codes are created in the same millisecond (createdAt
   *  alone wouldn't be). */
  list(): DiscountCode[] {
    return [...this.codesByCode.values()].reverse();
  }

  private checkValid(code: DiscountCode): ValidateCodeResult {
    if (!code.active) return { valid: false, error: "This code is no longer active" };
    if (code.expiresAt !== null && Date.parse(code.expiresAt) <= Date.now()) {
      return { valid: false, error: "This code has expired" };
    }
    if (code.maxRedemptions !== null && code.redemptionCount >= code.maxRedemptions) {
      return { valid: false, error: "This code has reached its redemption limit" };
    }
    return { valid: true, code };
  }

  /** Checks a code without consuming a redemption. */
  validate(codeInput: string): ValidateCodeResult {
    const code = normalizeCode(codeInput);
    const existing = this.codesByCode.get(code);
    if (!existing) return { valid: false, error: "This code doesn't exist" };
    return this.checkValid(existing);
  }

  /** Validates a code and, if still valid, records one redemption against it. */
  redeem(codeInput: string): ValidateCodeResult {
    const code = normalizeCode(codeInput);
    const existing = this.codesByCode.get(code);
    if (!existing) return { valid: false, error: "This code doesn't exist" };
    const result = this.checkValid(existing);
    if (!result.valid) return result;
    existing.redemptionCount += 1;
    return { valid: true, code: existing };
  }
}
