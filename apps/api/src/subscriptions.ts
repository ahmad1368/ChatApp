const SUBSCRIPTION_DURATION_DAYS = 30;
const TRIAL_DURATION_DAYS = 3;

export const SUBSCRIPTION_TIERS = ["gold", "platinum", "vip"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export interface Subscription {
  author: string;
  tier: SubscriptionTier;
  subscribedAt: string;
  expiresAt: string;
  isTrial: boolean;
  autoRenew: boolean;
}

export type SubscribeResult = { success: true; subscription: Subscription } | { success: false; error: string };
export type StartTrialResult = { success: true; subscription: Subscription } | { success: false; error: string };

export interface GiftPackage {
  id: string;
  tier: SubscriptionTier;
  days: number;
  coinCost: number;
}

/** Coffee Meets Bagel's real "Ability to gift a subscription to other users" (#210) — a fixed, one-per-tier 7-day gift, priced in #196's coins. */
export const GIFT_PACKAGES: GiftPackage[] = [
  { id: "gold-7", tier: "gold", days: 7, coinCost: 150 },
  { id: "platinum-7", tier: "platinum", days: 7, coinCost: 250 },
  { id: "vip-7", tier: "vip", days: 7, coinCost: 350 },
];

export function findGiftPackage(packageId: unknown): GiftPackage | undefined {
  return GIFT_PACKAGES.find((p) => p.id === packageId);
}

function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return typeof value === "string" && (SUBSCRIPTION_TIERS as readonly string[]).includes(value);
}

/**
 * Tinder's real "Premium subscription plans (Gold, Platinum, VIP)"
 * (#191). Real recurring billing via RevenueCat/Google Play Billing/
 * Apple IAP (the implementation guide's suggestion) needs a payment
 * processor and app-store accounts this environment doesn't have —
 * same disclosed gap as pricingPlans.ts's generic admin-managed plans
 * and #105/#106's free Boost ("no premium tier to gate it behind").
 * What's real here: three fixed, named tiers (unlike PricingPlanStore's
 * admin-configurable generic plans, these match Tinder's actual
 * product names), a genuine per-author entitlement with a real
 * subscribedAt/expiresAt (30-day period, checked against wall-clock
 * time — a subscription actually lapses), and self-service subscribe/
 * cancel since there's nothing to charge yet. Wiring a specific perk
 * (unlimited likes, see-who-liked-you, etc.) to require a tier is
 * separate, feature-specific follow-up, the same "infrastructure now,
 * adoption later" scoping call #187/#188 made for their own primitives.
 *
 * #202's "Free trial for a few days of subscription": real Tinder's
 * trial auto-converts to a real paid period on expiry via its billing
 * provider — this app has none, so a trial here just lapses like any
 * other subscription (`getStatus()` already handles that uniformly via
 * `isTrial`'s real 3-day `expiresAt` vs. a paid one's real 30 days); a
 * user still has to actually subscribe afterward. One-time-only per
 * author, the real anti-abuse rule Tinder also enforces, tracked in
 * `trialUsedByAuthor` independently of the subscription record itself
 * so cancelling or letting a trial lapse doesn't reset eligibility.
 *
 * #206's "Auto-renewable subscriptions": a real self-service
 * subscribe() defaults to `autoRenew: true`, same as real Tinder — on
 * expiry, `getStatus()` renews it for another full period at the same
 * tier instead of deleting it, the actual entitlement-continuation
 * behavior this issue asks for (there's still no real recurring charge
 * behind it, same disclosed payment-processor gap as subscribe()
 * itself). A trial, coupon grant, or referral reward is a one-time
 * perk, not an ongoing plan, so those default to `autoRenew: false`
 * and simply lapse, preserving #202's already-shipped trial behavior
 * exactly. `setAutoRenew()` lets a subscriber turn it off (still active
 * until the current period's real expiresAt, same as cancel() elsewhere
 * — this only stops the *next* renewal) or back on.
 */
export class SubscriptionStore {
  private byAuthor = new Map<string, Subscription>();
  private trialUsedByAuthor = new Set<string>();

  subscribe(author: unknown, tier: unknown): SubscribeResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (!isSubscriptionTier(tier)) return { success: false, error: `tier must be one of: ${SUBSCRIPTION_TIERS.join(", ")}` };

    const now = new Date();
    const subscription: Subscription = {
      author: authorText,
      tier,
      subscribedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      isTrial: false,
      autoRenew: true,
    };
    this.byAuthor.set(authorText, subscription);
    return { success: true, subscription };
  }

  hasUsedTrial(author: string): boolean {
    return this.trialUsedByAuthor.has(author);
  }

  startTrial(author: unknown, tier: unknown): StartTrialResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (!isSubscriptionTier(tier)) return { success: false, error: `tier must be one of: ${SUBSCRIPTION_TIERS.join(", ")}` };
    if (this.hasUsedTrial(authorText)) return { success: false, error: "You've already used your free trial" };
    if (this.getStatus(authorText)) return { success: false, error: "You already have an active subscription" };

    const now = new Date();
    const subscription: Subscription = {
      author: authorText,
      tier,
      subscribedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      isTrial: true,
      autoRenew: false,
    };
    this.byAuthor.set(authorText, subscription);
    this.trialUsedByAuthor.add(authorText);
    return { success: true, subscription };
  }

  /**
   * #203's "Discount code and upgrade coupon system": grants a
   * subscription for a custom duration (an admin-configured coupon's
   * own day count), distinct from subscribe()'s fixed 30-day paid
   * period or startTrial()'s fixed 3-day trial — this is the real
   * effect an UpgradeCouponStore-validated redemption actually applies
   * (see server.ts's POST /api/upgrade-coupons/redeem), not a
   * fabricated "coupon applied" confirmation with nothing behind it.
   */
  grantDays(author: unknown, tier: unknown, days: number): SubscribeResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (!isSubscriptionTier(tier)) return { success: false, error: `tier must be one of: ${SUBSCRIPTION_TIERS.join(", ")}` };

    const now = new Date();
    const subscription: Subscription = {
      author: authorText,
      tier,
      subscribedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
      isTrial: false,
      autoRenew: false,
    };
    this.byAuthor.set(authorText, subscription);
    return { success: true, subscription };
  }

  /**
   * #204's "Referral system to invite friends for free subscription
   * days": extends an already-active subscription by `days`, keeping
   * its current tier, rather than replacing it the way grantDays()
   * does — a referral reward should never shorten or downgrade what a
   * user already has. With no active subscription, grants a fresh one
   * at `tier` for `days`, same as grantDays().
   */
  extendOrGrant(author: unknown, tier: unknown, days: number): SubscribeResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (!isSubscriptionTier(tier)) return { success: false, error: `tier must be one of: ${SUBSCRIPTION_TIERS.join(", ")}` };

    const existing = this.getStatus(authorText);
    const baseTimeMs = existing ? new Date(existing.expiresAt).getTime() : Date.now();
    const subscription: Subscription = {
      author: authorText,
      tier: existing?.tier ?? tier,
      subscribedAt: existing?.subscribedAt ?? new Date().toISOString(),
      expiresAt: new Date(baseTimeMs + days * 24 * 60 * 60 * 1000).toISOString(),
      isTrial: false,
      autoRenew: existing?.autoRenew ?? false,
    };
    this.byAuthor.set(authorText, subscription);
    return { success: true, subscription };
  }

  /** Immediate hard removal — an admin/support tool, not what #207's in-app "Cancel" button below should call (see cancelAtPeriodEnd()). */
  cancel(author: string): boolean {
    return this.byAuthor.delete(author);
  }

  /**
   * Turns auto-renewal on or off for an already-active subscription.
   * Returns false if there's nothing active to change. Turning it off
   * doesn't end access early — the current period's real expiresAt is
   * untouched — it only stops the *next* renewal getStatus() would
   * otherwise apply.
   */
  setAutoRenew(author: string, autoRenew: boolean): boolean {
    const subscription = this.getStatus(author);
    if (!subscription) return false;
    subscription.autoRenew = autoRenew;
    return true;
  }

  /**
   * #207's "Manage subscription cancellation from within the app" —
   * the real cancellation behavior every actual subscription platform
   * (App Store, Play Store, a web billing portal) has: turning off
   * auto-renewal while keeping access until the period the user
   * already has actually ends, rather than revoking it immediately the
   * way cancel() above does. A thin, purpose-named wrapper over
   * setAutoRenew(author, false) that also hands back the real
   * expiresAt a "you'll keep access until…" confirmation needs.
   */
  cancelAtPeriodEnd(author: string): { success: true; expiresAt: string } | { success: false; error: string } {
    const subscription = this.getStatus(author);
    if (!subscription) return { success: false, error: "No active subscription for that author" };
    subscription.autoRenew = false;
    return { success: true, expiresAt: subscription.expiresAt };
  }

  /**
   * The active subscription, or undefined once it's lapsed (or never
   * existed) — a real wall-clock expiry check, not just presence in the
   * map. #206: an expired subscription with autoRenew on is rolled over
   * for another full period at the same tier (from its own expiresAt,
   * not "now", so a late check never drifts the schedule) instead of
   * being deleted.
   */
  getStatus(author: string): Subscription | undefined {
    const subscription = this.byAuthor.get(author);
    if (!subscription) return undefined;
    const now = Date.now();
    if (new Date(subscription.expiresAt).getTime() <= now) {
      if (!subscription.autoRenew) {
        this.byAuthor.delete(author);
        return undefined;
      }
      // Rolls forward one full period at a time (rather than jumping
      // straight to "now") so a subscriber who never happens to be
      // checked for several periods still accrues exactly as many real
      // renewals as actually elapsed, not just one.
      let expiresAtMs = new Date(subscription.expiresAt).getTime();
      while (expiresAtMs <= now) {
        subscription.subscribedAt = new Date(expiresAtMs).toISOString();
        expiresAtMs += SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000;
      }
      subscription.expiresAt = new Date(expiresAtMs).toISOString();
    }
    return subscription;
  }

  /** Every still-active subscriber — the admin view. */
  listActive(): Subscription[] {
    const now = Date.now();
    return [...this.byAuthor.values()].filter((s) => new Date(s.expiresAt).getTime() > now);
  }
}
