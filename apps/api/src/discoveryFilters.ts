import { MIN_HEIGHT_CM, MAX_HEIGHT_CM } from "./heightInfo";
import { LANGUAGE_CATALOG, Language } from "./languagesInfo";
import { DRINKING_OPTIONS, DrinkingOption, SmokingOption } from "./lifestyleInfo";

export interface DiscoveryFilters {
  minHeightCm: number | null;
  maxHeightCm: number | null;
  requireEducation: boolean;
  requiredLanguages: Language[];
  requireNonSmoking: boolean;
  allowedDrinking: DrinkingOption[];
}

export type UpdateDiscoveryFiltersResult =
  | { success: true; filters: DiscoveryFilters }
  | { success: false; error: string };

export interface CandidateProfileData {
  heightCm: number | null;
  hasEducation: boolean;
  languages: string[];
  smoking: SmokingOption | null;
  drinking: DrinkingOption | null;
}

const EMPTY_FILTERS: DiscoveryFilters = {
  minHeightCm: null,
  maxHeightCm: null,
  requireEducation: false,
  requiredLanguages: [],
  requireNonSmoking: false,
  allowedDrinking: [],
};

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGE_CATALOG as readonly string[]).includes(value);
}

function isDrinkingOption(value: unknown): value is DrinkingOption {
  return typeof value === "string" && (DRINKING_OPTIONS as readonly string[]).includes(value);
}

/**
 * OkCupid's real advanced discovery filters (#96, extended by #97 with
 * non-smoking/lifestyle), scoped to the fields the issues name — height,
 * education, language, smoking, drinking — from the profile data
 * #68/#69/#70/#73 already collect. Filtering reads that data regardless
 * of each candidate's own hide-on-my-profile flag (hideHeight, etc.): same
 * precedent as #94's interest-compatibility scorer reading interests
 * regardless of hideInterests — a "don't show this on my profile" choice
 * governs display (see profilePreview.ts), not whether it's usable as a
 * matching signal.
 *
 * Missing data fails a filter that requires it (no height set + a height
 * range filter excludes that candidate, rather than including them by
 * default) — the safer default for what the user explicitly asked to
 * filter on.
 */
export class DiscoveryFiltersStore {
  private filtersByAuthor = new Map<string, DiscoveryFilters>();

  update(
    author: unknown,
    minHeightCm: unknown,
    maxHeightCm: unknown,
    requireEducation: unknown,
    requiredLanguages: unknown,
    requireNonSmoking: unknown,
    allowedDrinking: unknown
  ): UpdateDiscoveryFiltersResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let min: number | null = null;
    if (minHeightCm !== null && minHeightCm !== undefined) {
      if (typeof minHeightCm !== "number" || !Number.isInteger(minHeightCm) || minHeightCm < MIN_HEIGHT_CM || minHeightCm > MAX_HEIGHT_CM) {
        return { success: false, error: `minHeightCm must be a whole number between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM}` };
      }
      min = minHeightCm;
    }

    let max: number | null = null;
    if (maxHeightCm !== null && maxHeightCm !== undefined) {
      if (typeof maxHeightCm !== "number" || !Number.isInteger(maxHeightCm) || maxHeightCm < MIN_HEIGHT_CM || maxHeightCm > MAX_HEIGHT_CM) {
        return { success: false, error: `maxHeightCm must be a whole number between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM}` };
      }
      max = maxHeightCm;
    }

    if (min !== null && max !== null && min > max) {
      return { success: false, error: "minHeightCm cannot be greater than maxHeightCm" };
    }

    if (!Array.isArray(requiredLanguages)) {
      return { success: false, error: "requiredLanguages must be a list" };
    }
    const languages: Language[] = [];
    for (const entry of requiredLanguages) {
      if (!isLanguage(entry)) {
        return { success: false, error: "Invalid language in requiredLanguages" };
      }
      languages.push(entry);
    }

    if (!Array.isArray(allowedDrinking)) {
      return { success: false, error: "allowedDrinking must be a list" };
    }
    const drinkingOptions: DrinkingOption[] = [];
    for (const entry of allowedDrinking) {
      if (!isDrinkingOption(entry)) {
        return { success: false, error: "Invalid drinking option in allowedDrinking" };
      }
      drinkingOptions.push(entry);
    }

    const filters: DiscoveryFilters = {
      minHeightCm: min,
      maxHeightCm: max,
      requireEducation: requireEducation === true,
      requiredLanguages: languages,
      requireNonSmoking: requireNonSmoking === true,
      allowedDrinking: drinkingOptions,
    };
    this.filtersByAuthor.set(authorName, filters);
    return { success: true, filters };
  }

  get(author: string): DiscoveryFilters {
    return this.filtersByAuthor.get(author) ?? EMPTY_FILTERS;
  }
}

/** Pure so it's trivial to unit test independent of the store. */
export function candidateMatchesFilters(filters: DiscoveryFilters, candidate: CandidateProfileData): boolean {
  if (filters.minHeightCm !== null && (candidate.heightCm === null || candidate.heightCm < filters.minHeightCm)) {
    return false;
  }
  if (filters.maxHeightCm !== null && (candidate.heightCm === null || candidate.heightCm > filters.maxHeightCm)) {
    return false;
  }
  if (filters.requireEducation && !candidate.hasEducation) {
    return false;
  }
  if (filters.requiredLanguages.length > 0 && !filters.requiredLanguages.some((l) => candidate.languages.includes(l))) {
    return false;
  }
  if (filters.requireNonSmoking && candidate.smoking !== "no") {
    return false;
  }
  if (filters.allowedDrinking.length > 0 && (candidate.drinking === null || !filters.allowedDrinking.includes(candidate.drinking))) {
    return false;
  }
  return true;
}
