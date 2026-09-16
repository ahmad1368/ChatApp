export const CALL_QUALITY_ISSUES = ["audioCutOut", "videoFroze", "echoOrNoise", "connectionDropped", "delay"] as const;
export type CallQualityIssue = (typeof CALL_QUALITY_ISSUES)[number];

const MIN_RATING = 1;
const MAX_RATING = 5;
const MAX_COMMENT_LENGTH = 500;

export interface CallQualityFeedback {
  callId: string;
  author: string;
  rating: number;
  issues: CallQualityIssue[];
  comment?: string;
  submittedAt: string;
}

export type SubmitCallQualityFeedbackResult = { success: true; feedback: CallQualityFeedback } | { success: false; error: string };

function isCallQualityIssue(value: unknown): value is CallQualityIssue {
  return typeof value === "string" && (CALL_QUALITY_ISSUES as readonly string[]).includes(value);
}

function normalizeIssues(value: unknown): CallQualityIssue[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return undefined;
  const issues = value.filter(isCallQualityIssue);
  return issues.length === value.length ? issues : undefined;
}

/**
 * Badoo's real "System to record feedback on voice/video call quality"
 * (#309) — a post-call rating + fixed issue-tag catalog (real technical
 * signals like "audio cut out"/"connection dropped", not a fabricated
 * automatic call-quality-scoring model this app has no telemetry
 * infrastructure for) plus optional free text, keyed by #128/#129's
 * `CallStore` call id. One submission per author per call (a resubmit
 * overwrites, matching #229's `DateSpotReviewStore` "one review per
 * author per subject" shape) — this store doesn't verify the call id
 * against `CallStore` itself, since that store deletes a call's record
 * the moment it ends (see calls.ts), before feedback could realistically
 * be collected.
 */
export class CallQualityFeedbackStore {
  private feedbackByKey = new Map<string, CallQualityFeedback>();

  submit(callId: unknown, author: unknown, rating: unknown, issues: unknown, comment: unknown): SubmitCallQualityFeedbackResult {
    const callIdValue = typeof callId === "string" ? callId.trim() : "";
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!callIdValue || !authorName) {
      return { success: false, error: "callId and author are required" };
    }
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
      return { success: false, error: `rating must be an integer between ${MIN_RATING} and ${MAX_RATING}` };
    }
    const normalizedIssues = normalizeIssues(issues);
    if (!normalizedIssues) {
      return { success: false, error: `issues must be from: ${CALL_QUALITY_ISSUES.join(", ")}` };
    }
    const trimmedComment = typeof comment === "string" ? comment.trim() : "";
    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      return { success: false, error: `comment must be ${MAX_COMMENT_LENGTH} characters or fewer` };
    }

    const feedback: CallQualityFeedback = {
      callId: callIdValue,
      author: authorName,
      rating,
      issues: normalizedIssues,
      ...(trimmedComment ? { comment: trimmedComment } : {}),
      submittedAt: new Date().toISOString(),
    };
    this.feedbackByKey.set(`${callIdValue}:${authorName}`, feedback);
    return { success: true, feedback };
  }

  get(callId: string, author: string): CallQualityFeedback | null {
    return this.feedbackByKey.get(`${callId}:${author}`) ?? null;
  }

  /** Newest first — for the admin dashboard. */
  listAll(): CallQualityFeedback[] {
    return [...this.feedbackByKey.values()].reverse();
  }
}
