export const BOOST_DURATION_MS = 30 * 60 * 1000; // 30 minutes, matching real Tinder Boost

export const BOOST_TIERS = ["boost", "superboost"] as const;
export type BoostTier = (typeof BOOST_TIERS)[number];

// Higher ranks first in SwipeStore.getCandidates() — see boostLevelOf().
const BOOST_LEVEL: Record<BoostTier, number> = { boost: 1, superboost: 2 };

export interface BoostStatus {
  active: boolean;
  tier: BoostTier | null;
  expiresAt: string | null;
}

export type ActivateBoostResult = { success: true; tier: BoostTier; expiresAt: string } | { success: false; error: string };

export interface BoostPackage {
  id: string;
  boosts: number;
  coinCost: number;
}

/** Tinder's real single-Boost vs. discounted-package pricing shape (#198), priced in #196's coins. */
export const BOOST_PACKAGES: BoostPackage[] = [
  { id: "single", boosts: 1, coinCost: 50 },
  { id: "pack5", boosts: 5, coinCost: 200 },
];

export type ActivateWithCreditResult = ActivateBoostResult;

function isBoostTier(value: unknown): value is BoostTier {
  return typeof value === "string" && (BOOST_TIERS as readonly string[]).includes(value);
}

export function findBoostPackage(packageId: unknown): BoostPackage | undefined {
  return BOOST_PACKAGES.find((p) => p.id === packageId);
}

/**
 * Tinder's real "Boost"/"Super Boost" (#105, extended by #106):
 * activating puts this author at the front of everyone else's discovery
 * order for 30 minutes. `activateBoost()` below is the original free
 * path (#105/#106's honest scoping call, made before this app had any
 * premium/currency infra to gate it behind, same as #92's free Rewind)
 * — left exactly as it was rather than retroactively broken, since
 * other code already depends on it working unconditionally. #198's
 * "Purchase a single Boost or Boost package" adds the real purchasable
 * alternative real Tinder also has alongside occasional free/promo
 * boosts: `purchaseCredits()` spends #196's coins for a stock of boost
 * credits (`BOOST_PACKAGES`, a single boost or a discounted 5-pack),
 * and `activateBoostWithCredit()` draws one down, reusing the exact
 * same activation mechanics as the free path. Super Boost outranks an
 * ordinary Boost in `getBoostLevel()` (consumed by
 * SwipeStore.getCandidates()'s ranking), matching real Tinder's
 * stronger multiplier for the paid-up tier — see swipes.ts for the
 * exact priority order against superlikes. One active boost per
 * author; activating again (at either tier, through either path)
 * simply resets the 30-minute window and tier from now, rather than
 * stacking duration.
 */
export class ProfileBoostStore {
  private boostByAuthor = new Map<string, { tier: BoostTier; expiresAt: number }>();
  private creditsByAuthor = new Map<string, number>();

  activateBoost(author: unknown, tier: unknown, now: number = Date.now()): ActivateBoostResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let tierValue: BoostTier = "boost";
    if (tier !== undefined && tier !== null) {
      if (!isBoostTier(tier)) {
        return { success: false, error: `tier must be one of: ${BOOST_TIERS.join(", ")}` };
      }
      tierValue = tier;
    }

    const expiresAt = now + BOOST_DURATION_MS;
    this.boostByAuthor.set(authorName, { tier: tierValue, expiresAt });
    return { success: true, tier: tierValue, expiresAt: new Date(expiresAt).toISOString() };
  }

  getCredits(author: string): number {
    return this.creditsByAuthor.get(author) ?? 0;
  }

  /** Coin-spending happens in the route handler (server.ts), same "orchestrate cross-store calls at the call site" shape #197's gift-sending uses — this only ever credits, never debits coins itself. */
  grantCredits(author: string, boosts: number): number {
    const credits = this.getCredits(author) + boosts;
    this.creditsByAuthor.set(author, credits);
    return credits;
  }

  activateBoostWithCredit(author: unknown, tier: unknown, now: number = Date.now()): ActivateWithCreditResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };
    if (this.getCredits(authorName) <= 0) {
      return { success: false, error: "No boost credits available — purchase a package first" };
    }

    const result = this.activateBoost(authorName, tier, now);
    if (result.success) this.creditsByAuthor.set(authorName, this.getCredits(authorName) - 1);
    return result;
  }

  isBoosted(author: string, now: number = Date.now()): boolean {
    return this.getBoostLevel(author, now) > 0;
  }

  /** 0 = no active boost, 1 = boost, 2 = superboost — higher ranks first. */
  getBoostLevel(author: string, now: number = Date.now()): number {
    const boost = this.boostByAuthor.get(author);
    if (!boost || boost.expiresAt <= now) return 0;
    return BOOST_LEVEL[boost.tier];
  }

  getStatus(author: string, now: number = Date.now()): BoostStatus {
    const boost = this.boostByAuthor.get(author);
    if (!boost || boost.expiresAt <= now) {
      return { active: false, tier: null, expiresAt: null };
    }
    return { active: true, tier: boost.tier, expiresAt: new Date(boost.expiresAt).toISOString() };
  }
}
