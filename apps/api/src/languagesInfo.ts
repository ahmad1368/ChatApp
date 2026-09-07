export const MAX_SELECTED_LANGUAGES = 5;

// A representative fixed catalog rather than the full ISO 639 list — same
// scoping call as #66's profile-prompt catalog.
export const LANGUAGE_CATALOG = [
  "english",
  "spanish",
  "mandarin",
  "hindi",
  "arabic",
  "portuguese",
  "bengali",
  "russian",
  "japanese",
  "french",
  "german",
  "korean",
  "italian",
  "turkish",
  "vietnamese",
  "polish",
  "dutch",
  "greek",
  "farsi",
  "urdu",
] as const;
export type Language = (typeof LANGUAGE_CATALOG)[number];

export interface LanguagesInfo {
  languages: Language[];
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#72's other profile-detail hide flags.
  hideLanguages: boolean;
}

export type UpdateLanguagesInfoResult =
  | { success: true; languagesInfo: LanguagesInfo }
  | { success: false; error: string };

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGE_CATALOG as readonly string[]).includes(value);
}

const EMPTY_LANGUAGES_INFO: LanguagesInfo = { languages: [], hideLanguages: false };

/**
 * Editable-anytime "languages I'm fluent in" (#73), same
 * one-value-per-author, replace-on-update shape as #67-#72's other
 * standalone profile fields. Up to 5 languages from a fixed catalog,
 * matching the fixed-catalog pattern already used by #66's profile prompts.
 */
export class LanguagesInfoStore {
  private infoByAuthor = new Map<string, LanguagesInfo>();

  update(author: unknown, languages: unknown, hideLanguages: unknown): UpdateLanguagesInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!Array.isArray(languages)) {
      return { success: false, error: "languages must be a list" };
    }
    if (languages.length > MAX_SELECTED_LANGUAGES) {
      return { success: false, error: `Choose at most ${MAX_SELECTED_LANGUAGES} languages` };
    }

    const seen = new Set<Language>();
    for (const entry of languages) {
      if (!isLanguage(entry)) {
        return { success: false, error: "Invalid language selected" };
      }
      if (seen.has(entry)) {
        return { success: false, error: "Each language can only be selected once" };
      }
      seen.add(entry);
    }

    const languagesInfo: LanguagesInfo = { languages: [...seen], hideLanguages: hideLanguages === true };
    this.infoByAuthor.set(authorName, languagesInfo);
    return { success: true, languagesInfo };
  }

  get(author: string): LanguagesInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_LANGUAGES_INFO;
  }
}
