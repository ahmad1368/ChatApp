import { SubscriptionTier, SUBSCRIPTION_TIERS } from "./subscriptions";

const MAX_CODE_LENGTH = 30;
const MAX_DAYS = 365;

export interface UpgradeCoupon {
  code: string;
  tier: SubscriptionTier;
  days: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
  createdAt: string;
}

export type CreateCouponResult = { success: true; coupon: UpgradeCoupon } | { success: false; error: string };
export type RedeemCouponResult = { success: true; coupon: UpgradeCoupon } | { success: false; error: string };

function normalizeCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return typeof value === "string" && (SUBSCRIPTION_TIERS as readonly string[]).includes(value);
}

/**
 * Tinder's real "Discount code and upgrade coupon system" (#203) — the
 * "upgrade coupon" half, distinct from #177's DiscountCodeStore price
 * discounts (which still have no checkout to apply to). An upgrade
 * coupon redemption has a genuinely real effect: it grants #191's
 * SubscriptionStore a real tier for a real, admin-configured number of
 * days (see server.ts's POST /api/upgrade-coupons/redeem calling
 * SubscriptionStore.grantDays()) — this store only validates and
 * tracks redemptions, the same "store validates, caller applies the
 * effect" split #197-#199 already use for coins/boosts/super likes.
 * One redemption per author per coupon, the same anti-abuse rule
 * #202's free trial enforces for itself.
 */
export class UpgradeCouponStore {
  private couponsByCode = new Map<string, UpgradeCoupon>();
  private redeemedKeys = new Set<string>();

  create(codeInput: unknown, tier: unknown, days: unknown, maxRedemptions: unknown): CreateCouponResult {
    const code = normalizeCode(codeInput);
    if (!code) return { success: false, error: "code is required" };
    if (code.length > MAX_CODE_LENGTH) return { success: false, error: `code must be ${MAX_CODE_LENGTH} characters or fewer` };
    if (this.couponsByCode.has(code)) return { success: false, error: "A coupon with this code already exists" };
    if (!isSubscriptionTier(tier)) return { success: false, error: `tier must be one of: ${SUBSCRIPTION_TIERS.join(", ")}` };
    if (typeof days !== "number" || !Number.isInteger(days) || days <= 0 || days > MAX_DAYS) {
      return { success: false, error: `days must be a positive integer up to ${MAX_DAYS}` };
    }

    let maxRedemptionsValue: number | null = null;
    if (maxRedemptions !== undefined && maxRedemptions !== null) {
      if (typeof maxRedemptions !== "number" || !Number.isInteger(maxRedemptions) || maxRedemptions <= 0) {
        return { success: false, error: "maxRedemptions must be a positive integer" };
      }
      maxRedemptionsValue = maxRedemptions;
    }

    const coupon: UpgradeCoupon = {
      code,
      tier,
      days,
      maxRedemptions: maxRedemptionsValue,
      redemptionCount: 0,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.couponsByCode.set(code, coupon);
    return { success: true, coupon };
  }

  deactivate(codeInput: string): boolean {
    const code = normalizeCode(codeInput);
    const existing = this.couponsByCode.get(code);
    if (!existing || !existing.active) return false;
    existing.active = false;
    return true;
  }

  /** Every coupon ever created, newest first — the admin management view. */
  list(): UpgradeCoupon[] {
    return [...this.couponsByCode.values()].reverse();
  }

  /** Validates a redemption and records it — the caller applies the actual subscription grant. */
  redeem(codeInput: unknown, author: unknown): RedeemCouponResult {
    const code = normalizeCode(codeInput);
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };

    const coupon = this.couponsByCode.get(code);
    if (!coupon) return { success: false, error: "This coupon doesn't exist" };
    if (!coupon.active) return { success: false, error: "This coupon is no longer active" };
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      return { success: false, error: "This coupon has reached its redemption limit" };
    }
    const redemptionKey = `${authorText}:${code}`;
    if (this.redeemedKeys.has(redemptionKey)) {
      return { success: false, error: "You've already redeemed this coupon" };
    }

    coupon.redemptionCount += 1;
    this.redeemedKeys.add(redemptionKey);
    return { success: true, coupon };
  }
}
