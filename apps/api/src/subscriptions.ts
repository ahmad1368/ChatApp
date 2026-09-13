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
}

export type SubscribeResult = { success: true; subscription: Subscription } | { success: false; error: string };
export type StartTrialResult = { success: true; subscription: Subscription } | { success: false; error: string };

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
    };
    this.byAuthor.set(authorText, subscription);
    return { success: true, subscription };
  }

  cancel(author: string): boolean {
    return this.byAuthor.delete(author);
  }

  /** The active subscription, or undefined once it's lapsed (or never existed) — a real wall-clock expiry check, not just presence in the map. */
  getStatus(author: string): Subscription | undefined {
    const subscription = this.byAuthor.get(author);
    if (!subscription) return undefined;
    if (new Date(subscription.expiresAt).getTime() <= Date.now()) {
      this.byAuthor.delete(author);
      return undefined;
    }
    return subscription;
  }

  /** Every still-active subscriber — the admin view. */
  listActive(): Subscription[] {
    const now = Date.now();
    return [...this.byAuthor.values()].filter((s) => new Date(s.expiresAt).getTime() > now);
  }
}
