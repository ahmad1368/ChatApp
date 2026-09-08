import { GENDER_OPTIONS, GenderOption } from "@chatapp/shared";

export type SetGenderResult = { success: true; gender: GenderOption } | { success: false; error: string };

function isGenderOption(value: unknown): value is GenderOption {
  return typeof value === "string" && (GENDER_OPTIONS as readonly string[]).includes(value);
}

/**
 * Per-chat-author gender declaration used to enforce #135's "women
 * message first" rule (see firstMessageRule.ts). A separate store from
 * #21-28's auth-gated onboarding gender field (onboarding.ts) — same "own
 * per-field store keyed by chat author" pattern as #67-89's other profile
 * info (heightInfo.ts, interestsInfo.ts, etc.) rather than bridging to a
 * real userId-keyed system this app's guest chat identities aren't merged
 * with yet. No "hide" concept: unlike a cosmetic profile detail, gender
 * needs to be known to enforce the rule at all — an author who hasn't
 * declared one just means the rule doesn't apply to them (see
 * firstMessageRule.ts's undefined-gender handling).
 */
export class GenderInfoStore {
  private genderByAuthor = new Map<string, GenderOption>();

  set(author: unknown, gender: unknown): SetGenderResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!isGenderOption(gender)) {
      return { success: false, error: `gender must be one of: ${GENDER_OPTIONS.join(", ")}` };
    }
    this.genderByAuthor.set(authorName, gender);
    return { success: true, gender };
  }

  get(author: string): GenderOption | undefined {
    return this.genderByAuthor.get(author);
  }
}
