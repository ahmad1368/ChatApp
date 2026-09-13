const SUBSCRIPTION_DURATION_DAYS = 30;

export const SUBSCRIPTION_TIERS = ["gold", "platinum", "vip"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export interface Subscription {
  author: string;
  tier: SubscriptionTier;
  subscribedAt: string;
  expiresAt: string;
}

export type SubscribeResult = { success: true; subscription: Subscription } | { success: false; error: string };

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
 */
export class SubscriptionStore {
  private byAuthor = new Map<string, Subscription>();

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
