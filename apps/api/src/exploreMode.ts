import { Interest } from "./interestsInfo";

export const EXPLORE_MODES = ["cafes", "sports", "travel"] as const;
export type ExploreMode = (typeof EXPLORE_MODES)[number];

// Each theme is a curated subset of #79's fixed interest catalog — Tinder's
// real Explore doesn't run a separate recommendation model per theme, it
// just narrows the deck to people whose profile fits the theme's vibe.
export const EXPLORE_MODE_INTERESTS: Record<ExploreMode, Interest[]> = {
  cafes: ["coffee", "foodie", "baking", "wine", "reading"],
  sports: ["gym", "running", "cycling", "hiking", "yoga"],
  travel: ["travel", "camping", "photography", "hiking"],
};

export type UpdateExploreModeResult =
  | { success: true; mode: ExploreMode | null }
  | { success: false; error: string };

function isExploreMode(value: unknown): value is ExploreMode {
  return typeof value === "string" && (EXPLORE_MODES as readonly string[]).includes(value);
}

/**
 * Tinder's real Explore Mode (#99): the swiper picks one themed deck
 * (cafes/sports/travel) instead of browsing everyone; `null` means "no
 * theme active", the normal, unfiltered /discover deck. One active theme
 * per author, same replace-on-update shape as #96's DiscoveryFiltersStore
 * — kept as its own store rather than folded into DiscoveryFiltersStore
 * because it's a single named mode selection, not a set of independently
 * togglable filters.
 */
export class ExploreModeStore {
  private modeByAuthor = new Map<string, ExploreMode | null>();

  update(author: unknown, mode: unknown): UpdateExploreModeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    if (mode === null) {
      this.modeByAuthor.set(authorName, null);
      return { success: true, mode: null };
    }

    if (!isExploreMode(mode)) {
      return { success: false, error: `mode must be one of: ${EXPLORE_MODES.join(", ")}, or null` };
    }

    this.modeByAuthor.set(authorName, mode);
    return { success: true, mode };
  }

  get(author: string): ExploreMode | null {
    return this.modeByAuthor.get(author) ?? null;
  }
}

/**
 * Pure so it's trivial to unit test independent of the store. A candidate
 * matches a theme if they share at least one of that theme's interest
 * tags — same "at least one overlap" rule as #96's requiredLanguages,
 * reading the candidate's raw interests regardless of hideInterests (same
 * precedent as #94's compatibility scorer). No active mode matches
 * everyone.
 */
export function candidateMatchesExploreMode(mode: ExploreMode | null, candidateInterests: Interest[]): boolean {
  if (mode === null) return true;
  return EXPLORE_MODE_INTERESTS[mode].some((interest) => candidateInterests.includes(interest));
}
