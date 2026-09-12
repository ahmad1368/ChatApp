import { Interest } from "./interestsInfo";
import { ExploreThemeStore } from "./exploreThemes";

export type UpdateExploreModeResult =
  | { success: true; mode: string | null }
  | { success: false; error: string };

/**
 * Tinder's real Explore Mode (#99): the swiper picks one themed deck
 * instead of browsing everyone; `null` means "no theme active", the
 * normal, unfiltered /discover deck. One active theme per author, same
 * replace-on-update shape as #96's DiscoveryFiltersStore.
 *
 * #182 made the theme catalog admin-managed (see exploreThemes.ts) — a
 * mode is now validated against a real, currently-active ExploreTheme
 * rather than a fixed enum, so a theme an admin later deactivates stops
 * being selectable without needing a code change here.
 */
export class ExploreModeStore {
  private modeByAuthor = new Map<string, string | null>();

  constructor(private readonly exploreThemeStore: ExploreThemeStore) {}

  update(author: unknown, mode: unknown): UpdateExploreModeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    if (mode === null) {
      this.modeByAuthor.set(authorName, null);
      return { success: true, mode: null };
    }

    if (typeof mode !== "string" || !this.exploreThemeStore.get(mode)?.active) {
      return { success: false, error: "mode must be the id of an active explore theme, or null" };
    }

    this.modeByAuthor.set(authorName, mode);
    return { success: true, mode };
  }

  get(author: string): string | null {
    return this.modeByAuthor.get(author) ?? null;
  }
}

/**
 * Pure so it's trivial to unit test independent of the store. A candidate
 * matches a theme if they share at least one of that theme's interest
 * tags — same "at least one overlap" rule as #96's requiredLanguages,
 * reading the candidate's raw interests regardless of hideInterests (same
 * precedent as #94's compatibility scorer). `themeInterests: null` (no
 * active theme, or a theme the caller couldn't resolve) matches everyone.
 */
export function candidateMatchesExploreMode(themeInterests: Interest[] | null, candidateInterests: Interest[]): boolean {
  if (themeInterests === null) return true;
  return themeInterests.some((interest) => candidateInterests.includes(interest));
}
