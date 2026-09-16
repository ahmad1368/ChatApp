const MAX_FEEDBACK_LENGTH = 500;

export interface DateReview {
  reviewer: string;
  reviewedAuthor: string;
  didMeet: boolean;
  rating: number | null;
  feedback: string;
  submittedAt: string;
}

export type SubmitDateReviewResult = { success: true; review: DateReview } | { success: false; error: string };

function reviewKey(reviewer: string, reviewedAuthor: string): string {
  return `${reviewer}::${reviewedAuthor}`;
}

/**
 * Hinge's real "We Met" post-date feedback (#263) — genuinely
 * confidential, distinct from #229's public Yelp-style venue reviews:
 * a review here is only ever readable by the reviewer who wrote it,
 * never by the person it's about or any other author. One review per
 * direction per pair (alice-about-bob and bob-about-alice are entirely
 * separate entries), replace-on-resubmit like this app's other
 * standalone fields. `rating` is only meaningful when `didMeet` is
 * true — Hinge's real flow asks "did you meet up?" before asking how it
 * went, so a "no" answer has nothing to rate.
 */
export class DateReviewStore {
  private reviewsByKey = new Map<string, DateReview>();

  submit(
    reviewer: unknown,
    reviewedAuthor: unknown,
    didMeet: unknown,
    rating: unknown,
    feedback: unknown
  ): SubmitDateReviewResult {
    const reviewerName = typeof reviewer === "string" ? reviewer.trim() : "";
    const reviewedName = typeof reviewedAuthor === "string" ? reviewedAuthor.trim() : "";
    if (!reviewerName || !reviewedName) {
      return { success: false, error: "reviewer and reviewedAuthor are required" };
    }
    if (reviewerName === reviewedName) {
      return { success: false, error: "You can't review yourself" };
    }
    if (typeof didMeet !== "boolean") {
      return { success: false, error: "didMeet must be a boolean" };
    }

    let ratingValue: number | null = null;
    if (didMeet) {
      if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return { success: false, error: "rating must be a whole number between 1 and 5" };
      }
      ratingValue = rating;
    }

    const feedbackText = typeof feedback === "string" ? feedback.trim().slice(0, MAX_FEEDBACK_LENGTH) : "";

    const review: DateReview = {
      reviewer: reviewerName,
      reviewedAuthor: reviewedName,
      didMeet,
      rating: ratingValue,
      feedback: feedbackText,
      submittedAt: new Date().toISOString(),
    };
    this.reviewsByKey.set(reviewKey(reviewerName, reviewedName), review);
    return { success: true, review };
  }

  /** Confidential by construction: only ever looked up by the reviewer themselves, never the reviewed author. */
  getMyReview(reviewer: string, reviewedAuthor: string): DateReview | undefined {
    return this.reviewsByKey.get(reviewKey(reviewer, reviewedAuthor));
  }
}
