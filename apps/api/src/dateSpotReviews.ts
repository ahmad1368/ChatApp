import { randomUUID } from "crypto";

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export interface DateSpotReview {
  id: string;
  venue: string;
  author: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface DateSpotSummary {
  venue: string;
  averageRating: number;
  reviewCount: number;
}

export type PostReviewResult = { success: true; review: DateSpotReview } | { success: false; error: string };

/**
 * Match.com's real "Ability to post reviews and experiences from good
 * date spots" (#229): a real Yelp-style review — a named venue, a 1-5
 * rating, and free-text experience — distinct from #224's
 * VenueCheckInStore (a live, expiring "I'm here now" presence signal,
 * never a persisted opinion about the place) and from #147's
 * dateProposals.ts (a fixed catalog of activity *categories* like
 * "cinema"/"cafe", not real named venues or reviews of them). One author
 * can leave one review per venue — posting again edits their existing
 * review rather than padding the same person's opinion into the average
 * twice.
 */
export class DateSpotReviewStore {
  private reviewsByVenue = new Map<string, Map<string, DateSpotReview>>();

  post(author: unknown, payload: { venue?: unknown; rating?: unknown; text?: unknown } | undefined): PostReviewResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const venue = typeof payload?.venue === "string" ? payload.venue.trim() : "";
    if (!venue) return { success: false, error: "venue is required" };

    const rating = payload?.rating;
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
      return { success: false, error: `rating must be an integer from ${MIN_RATING} to ${MAX_RATING}` };
    }

    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!text) return { success: false, error: "text is required" };

    let reviewsForVenue = this.reviewsByVenue.get(venue);
    if (!reviewsForVenue) {
      reviewsForVenue = new Map();
      this.reviewsByVenue.set(venue, reviewsForVenue);
    }

    const existing = reviewsForVenue.get(authorName);
    const review: DateSpotReview = {
      id: existing?.id ?? randomUUID(),
      venue,
      author: authorName,
      rating,
      text,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    reviewsForVenue.set(authorName, review);
    return { success: true, review };
  }

  /** Newest first. */
  listReviews(venue: string): DateSpotReview[] {
    const reviewsForVenue = this.reviewsByVenue.get(venue);
    if (!reviewsForVenue) return [];
    return [...reviewsForVenue.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getVenueSummary(venue: string): DateSpotSummary | undefined {
    const reviewsForVenue = this.reviewsByVenue.get(venue);
    if (!reviewsForVenue || reviewsForVenue.size === 0) return undefined;
    const ratings = [...reviewsForVenue.values()].map((r) => r.rating);
    const averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    return { venue, averageRating, reviewCount: ratings.length };
  }

  /** Every reviewed venue, best-rated first. */
  listVenues(): DateSpotSummary[] {
    return [...this.reviewsByVenue.keys()]
      .map((venue) => this.getVenueSummary(venue)!)
      .sort((a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount);
  }
}
