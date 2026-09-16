export const FEEDBACK_CATEGORIES = ["bug", "featureRequest", "general"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

const MAX_MESSAGE_LENGTH = 2000;

export interface StoredFeedback {
  id: string;
  author: string;
  category: FeedbackCategory;
  message: string;
  createdAt: string;
}

export type SubmitFeedbackResult = { success: true; feedback: StoredFeedback } | { success: false; error: string };

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Bumble's real "Ability to send direct feedback to the development
 * team" (#294) — distinct from #180's `SupportTicketStore`: a support
 * ticket is a two-way thread expecting a reply and resolution; this is a
 * one-way note (bug/feature idea/general comment) that just needs to
 * reach the team, the same shape as #58's ErrorReportStore but user-
 * authored in their own words rather than an automatic crash dump, so
 * (unlike error reports, which may carry stack traces/URLs) it's safe to
 * expose to admins over a real read endpoint.
 */
export class FeedbackStore {
  private feedback: StoredFeedback[] = [];
  private nextId = 1;

  submit(author: unknown, category: unknown, message: unknown): SubmitFeedbackResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!isFeedbackCategory(category)) {
      return { success: false, error: `category must be one of: ${FEEDBACK_CATEGORIES.join(", ")}` };
    }
    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    if (!trimmedMessage) {
      return { success: false, error: "message is required" };
    }
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` };
    }

    const feedback: StoredFeedback = {
      id: String(this.nextId++),
      author: authorName,
      category,
      message: trimmedMessage,
      createdAt: new Date().toISOString(),
    };
    this.feedback.push(feedback);
    return { success: true, feedback };
  }

  /** Newest first — for the admin dashboard. */
  listAll(): StoredFeedback[] {
    return [...this.feedback].reverse();
  }

  count(): number {
    return this.feedback.length;
  }
}
