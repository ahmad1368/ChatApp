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

function isBoostTier(value: unknown): value is BoostTier {
  return typeof value === "string" && (BOOST_TIERS as readonly string[]).includes(value);
}

/**
 * Tinder's real "Boost"/"Super Boost" (#105, extended by #106): activating
 * puts this author at the front of everyone else's discovery order for 30
 * minutes — real Tinder sells both tiers; this app has no premium tier,
 * so both are free here, same scoping call as #92's free Rewind and
 * #101's free Top Picks. Super Boost outranks an ordinary Boost in
 * `getBoostLevel()` (consumed by SwipeStore.getCandidates()'s ranking),
 * matching real Tinder's stronger multiplier for the paid-up tier — see
 * swipes.ts for the exact priority order against superlikes. One active
 * boost per author; activating again (at either tier) simply resets the
 * 30-minute window and tier from now, rather than stacking duration.
 */
export class ProfileBoostStore {
  private boostByAuthor = new Map<string, { tier: BoostTier; expiresAt: number }>();

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
