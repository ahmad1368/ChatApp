export const DEFAULT_DESIRABILITY_RATING = 1500;
const K_FACTOR = 32; // standard chess/Elo K-factor

export interface SmartScore {
  desirabilityRating: number;
  activityCount: number;
}

/**
 * Tinder's real (in)famous "Elo Score" — later rebranded "Smart Score" —
 * quietly rated how desirable a profile was based on who liked/passed it
 * and how desirable *those* people were, standard chess Elo math applied
 * to swipe outcomes rather than game wins. Kept as its own store rather
 * than folded into SwipeStore: recording an outcome here is a side effect
 * of a swipe, not part of the swipe/match decision itself, and this keeps
 * both stores independently testable — same reasoning as #94's
 * compatibility scorer being computed and injected at the route level
 * rather than living inside SwipeStore.
 *
 * "Activity" (the issue's other named signal) is tracked as a simple swipe
 * count per author rather than blended into one composite number — Tinder
 * never published the actual weighting of its real Smart Score, so
 * inventing a specific formula to combine the two would be fabricating
 * detail the reference product doesn't document. Both are exposed
 * separately and a caller can weigh them however it needs to.
 */
export class SmartScoreStore {
  private ratingByAuthor = new Map<string, number>();
  private activityByAuthor = new Map<string, number>();

  getRating(author: string): number {
    return this.ratingByAuthor.get(author) ?? DEFAULT_DESIRABILITY_RATING;
  }

  getActivityCount(author: string): number {
    return this.activityByAuthor.get(author) ?? 0;
  }

  getScore(author: string): SmartScore {
    return { desirabilityRating: this.getRating(author), activityCount: this.getActivityCount(author) };
  }

  /**
   * Call once per swipe: `swiper` looked at `swiped` and liked or passed.
   * Bumps the swiper's own activity count, then applies a standard Elo
   * update to the swiped author's desirability rating using the swiper's
   * current rating as the "opponent" strength — a like from a
   * higher-rated swiper raises the swiped author's rating more than a
   * like from a lower-rated one, matching real Elo dynamics.
   */
  recordSwipeOutcome(swiper: string, swiped: string, liked: boolean): void {
    this.activityByAuthor.set(swiper, this.getActivityCount(swiper) + 1);

    const swiperRating = this.getRating(swiper);
    const swipedRating = this.getRating(swiped);
    const expectedOutcome = 1 / (1 + 10 ** ((swiperRating - swipedRating) / 400));
    const actualOutcome = liked ? 1 : 0;
    const updatedRating = swipedRating + K_FACTOR * (actualOutcome - expectedOutcome);
    this.ratingByAuthor.set(swiped, Math.round(updatedRating));
  }
}
