import { MIN_AGE, MAX_AGE } from "./ageInfo";

export interface MessageAgeLimit {
  minAge: number | null;
  maxAge: number | null;
}

export type UpdateMessageAgeLimitResult = { success: true; limit: MessageAgeLimit } | { success: false; error: string };

const EMPTY_LIMIT: MessageAgeLimit = { minAge: null, maxAge: null };

function isValidBound(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_AGE && value <= MAX_AGE;
}

/**
 * Tinder's real "Ability to set an exact age limit for receiving
 * messages" (#312) — a real min/max age range an author sets for who's
 * allowed to send them a first message, enforced in server.ts's
 * message:send handler the same way as #135's "women message first"
 * gender rule (see messageAgeLimitRule.ts): only checked for the very
 * first message in a fresh 1:1 match room, since #135's own doc comment
 * establishes this app's chat has no other formal "these two only"
 * concept to gate on. Against #312's own real prerequisite, ageInfo.ts's
 * self-reported (not ID-verified) age.
 */
export class MessageAgeLimitStore {
  private limitByAuthor = new Map<string, MessageAgeLimit>();

  update(author: unknown, minAge: unknown, maxAge: unknown): UpdateMessageAgeLimitResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let min: number | null = null;
    if (minAge !== null && minAge !== undefined) {
      if (!isValidBound(minAge)) {
        return { success: false, error: `minAge must be a whole number between ${MIN_AGE} and ${MAX_AGE}` };
      }
      min = minAge;
    }
    let max: number | null = null;
    if (maxAge !== null && maxAge !== undefined) {
      if (!isValidBound(maxAge)) {
        return { success: false, error: `maxAge must be a whole number between ${MIN_AGE} and ${MAX_AGE}` };
      }
      max = maxAge;
    }
    if (min !== null && max !== null && min > max) {
      return { success: false, error: "minAge cannot be greater than maxAge" };
    }

    const limit: MessageAgeLimit = { minAge: min, maxAge: max };
    this.limitByAuthor.set(authorName, limit);
    return { success: true, limit };
  }

  get(author: string): MessageAgeLimit {
    return this.limitByAuthor.get(author) ?? EMPTY_LIMIT;
  }
}
