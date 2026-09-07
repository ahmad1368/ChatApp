export const MAX_SELECTED_INTERESTS = 10;

// A representative fixed catalog of Hinge-style ready-made interest/
// lifestyle tags rather than the fully schema-driven, backend-configurable
// system the issue's implementation guide describes — same scoping call as
// #66's profile prompts and #73's languages.
export const INTEREST_CATALOG = [
  "hiking",
  "yoga",
  "gym",
  "running",
  "cycling",
  "cooking",
  "baking",
  "coffee",
  "wine",
  "photography",
  "painting",
  "writing",
  "reading",
  "gaming",
  "movies",
  "livemusic",
  "concerts",
  "dancing",
  "travel",
  "camping",
  "gardening",
  "volunteering",
  "sustainability",
  "meditation",
  "podcasts",
  "boardgames",
  "fashion",
  "foodie",
  "dogs",
  "cats",
] as const;
export type Interest = (typeof INTEREST_CATALOG)[number];

export interface InterestsInfo {
  interests: Interest[];
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#78's other profile-detail hide flags.
  hideInterests: boolean;
}

export type UpdateInterestsInfoResult =
  | { success: true; interestsInfo: InterestsInfo }
  | { success: false; error: string };

function isInterest(value: unknown): value is Interest {
  return typeof value === "string" && (INTEREST_CATALOG as readonly string[]).includes(value);
}

const EMPTY_INTERESTS_INFO: InterestsInfo = { interests: [], hideInterests: false };

/**
 * Editable-anytime interests/lifestyle tags (#79), same
 * one-value-per-author, replace-on-update shape as #67-#78's other
 * standalone profile fields. Up to 10 selections from a fixed catalog, same
 * fixed-catalog multi-select pattern as #73's languages and #75's pets.
 */
export class InterestsInfoStore {
  private infoByAuthor = new Map<string, InterestsInfo>();

  update(author: unknown, interests: unknown, hideInterests: unknown): UpdateInterestsInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!Array.isArray(interests)) {
      return { success: false, error: "interests must be a list" };
    }
    if (interests.length > MAX_SELECTED_INTERESTS) {
      return { success: false, error: `Choose at most ${MAX_SELECTED_INTERESTS} interests` };
    }

    const seen = new Set<Interest>();
    for (const entry of interests) {
      if (!isInterest(entry)) {
        return { success: false, error: "Invalid interest selected" };
      }
      if (seen.has(entry)) {
        return { success: false, error: "Each interest can only be selected once" };
      }
      seen.add(entry);
    }

    const interestsInfo: InterestsInfo = { interests: [...seen], hideInterests: hideInterests === true };
    this.infoByAuthor.set(authorName, interestsInfo);
    return { success: true, interestsInfo };
  }

  get(author: string): InterestsInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_INTERESTS_INFO;
  }
}
