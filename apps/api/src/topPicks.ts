export const DAILY_TOP_PICKS_COUNT = 5;

export interface TopPick {
  author: string;
  desirabilityRating: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tinder's real "Top Picks" (#101): a small, once-per-day curated
 * subset of the discovery pool. Real Tinder documents Top Picks as
 * powered by the same Elo/desirability signal as its Smart Score, so
 * this ranks the injected candidate pool by #95's `SmartScoreStore`
 * desirability rating (highest first) rather than inventing a separate
 * "quality" model. Callers pass in the eligible pool (already filtered
 * by blocks/#96-#99's discovery filters) and a rating lookup, keeping
 * this store decoupled from SwipeStore/SmartScoreStore the same way
 * discoveryFilters.ts and exploreMode.ts stay decoupled.
 *
 * "Daily" means the list is generated once and then cached until the UTC
 * date changes — re-requesting within the same day returns the same
 * picks even if the underlying pool or ratings shift, matching Tinder's
 * real once-a-day refresh rather than silently re-ranking on every call.
 * An empty pool is never cached: the caller's discovery-join and
 * top-picks requests aren't ordered against each other, so a client that
 * asks for picks before joining discovery would otherwise permanently
 * lock in an empty list for the rest of the day.
 */
export class TopPicksStore {
  private picksByAuthor = new Map<string, { date: string; picks: TopPick[] }>();

  getTopPicks(author: string, candidatePool: string[], getDesirabilityRating: (candidate: string) => number): TopPick[] {
    const today = todayKey();
    const cached = this.picksByAuthor.get(author);
    if (cached && cached.date === today) {
      return cached.picks;
    }

    const picks = candidatePool
      .map((candidate) => ({ author: candidate, desirabilityRating: getDesirabilityRating(candidate) }))
      .sort((a, b) => b.desirabilityRating - a.desirabilityRating)
      .slice(0, DAILY_TOP_PICKS_COUNT);

    if (picks.length > 0) {
      this.picksByAuthor.set(author, { date: today, picks });
    }
    return picks;
  }
}
