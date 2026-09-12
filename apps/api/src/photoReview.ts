export const PHOTO_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type PhotoReviewStatus = (typeof PHOTO_REVIEW_STATUSES)[number];

export interface PhotoReviewEntry {
  photoId: string;
  author: string;
  status: PhotoReviewStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reason: string | null;
}

export type ReviewDecisionResult = { success: true; entry: PhotoReviewEntry } | { success: false; error: string };

function isDecisionStatus(value: unknown): value is "approved" | "rejected" {
  return value === "approved" || value === "rejected";
}

/**
 * Bumble's real "Smart and manual review of uploaded photos" (#172) —
 * second issue in the "Admin Panel & Moderation" category, built on
 * #171's admin-key gate. "Smart" here is honestly scoped the same way
 * #107's fakeProfileDetector and #144's photoWarning.ts are: reusing the
 * real report-count signal this app already tracks (ReportStore) to
 * auto-prioritize the queue by severity, exactly what the implementation
 * guide asks for — not a fabricated ML image classifier this environment
 * has no model or credentials for. "Manual" is the actual admin
 * approve/reject decision, which is the real enforcement point; a
 * rejected photo isn't just flagged, server.ts also removes it from the
 * owner's album (see PhotoAlbumStore.removePhoto) so the decision has a
 * real effect on what other users can see.
 */
export class PhotoReviewStore {
  private entriesByPhotoId = new Map<string, PhotoReviewEntry>();

  /** Called once per upload (server.ts's POST /api/photos) — a photo already queued (e.g. a retry) is left alone. */
  enqueue(photoId: string, author: string): void {
    if (this.entriesByPhotoId.has(photoId)) return;
    this.entriesByPhotoId.set(photoId, {
      photoId,
      author,
      status: "pending",
      reviewedAt: null,
      reviewedBy: null,
      reason: null,
    });
  }

  /** Every pending entry, highest report-count author first — the real "auto-prioritize by report severity" the issue asks for. */
  getPendingQueue(getReportCount: (author: string) => number): PhotoReviewEntry[] {
    return [...this.entriesByPhotoId.values()]
      .filter((entry) => entry.status === "pending")
      .sort((a, b) => getReportCount(b.author) - getReportCount(a.author));
  }

  decide(photoId: unknown, reviewer: unknown, status: unknown, reason: unknown): ReviewDecisionResult {
    const id = typeof photoId === "string" ? photoId.trim() : "";
    const reviewerName = typeof reviewer === "string" ? reviewer.trim() : "";
    if (!id) {
      return { success: false, error: "photoId is required" };
    }
    if (!reviewerName) {
      return { success: false, error: "reviewer is required" };
    }
    if (!isDecisionStatus(status)) {
      return { success: false, error: "status must be 'approved' or 'rejected'" };
    }
    const entry = this.entriesByPhotoId.get(id);
    if (!entry) {
      return { success: false, error: "Photo not found in the review queue" };
    }

    entry.status = status;
    entry.reviewedAt = new Date().toISOString();
    entry.reviewedBy = reviewerName;
    entry.reason = typeof reason === "string" && reason.trim() ? reason.trim() : null;
    return { success: true, entry: { ...entry } };
  }

  get(photoId: string): PhotoReviewEntry | undefined {
    return this.entriesByPhotoId.get(photoId);
  }
}
