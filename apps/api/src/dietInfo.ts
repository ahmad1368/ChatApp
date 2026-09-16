// OkCupid's real diet-type field.
export const DIET_OPTIONS = ["omnivore", "vegetarian", "vegan", "pescatarian", "other"] as const;
export type DietOption = (typeof DIET_OPTIONS)[number];

export interface DietInfo {
  diet: DietOption | null;
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#75's other profile-detail hide flags.
  hideDiet: boolean;
}

export type UpdateDietInfoResult = { success: true; dietInfo: DietInfo } | { success: false; error: string };

export function isDietOption(value: unknown): value is DietOption {
  return typeof value === "string" && (DIET_OPTIONS as readonly string[]).includes(value);
}

const EMPTY_DIET_INFO: DietInfo = { diet: null, hideDiet: false };

/**
 * Editable-anytime diet-type status (#301), same one-value-per-author,
 * replace-on-update shape as #70's smoking/drinking — a single fixed-
 * choice enum (matching OkCupid's real UI, a picker not free text)
 * rather than a multi-select like #75's pets.
 */
export class DietInfoStore {
  private dietInfoByAuthor = new Map<string, DietInfo>();

  update(author: unknown, diet: unknown, hideDiet: unknown): UpdateDietInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let dietValue: DietOption | null = null;
    if (diet !== null && diet !== undefined) {
      if (!isDietOption(diet)) {
        return { success: false, error: `diet must be one of: ${DIET_OPTIONS.join(", ")}` };
      }
      dietValue = diet;
    }

    const dietInfo: DietInfo = { diet: dietValue, hideDiet: hideDiet === true };
    this.dietInfoByAuthor.set(authorName, dietInfo);
    return { success: true, dietInfo };
  }

  get(author: string): DietInfo {
    return this.dietInfoByAuthor.get(author) ?? EMPTY_DIET_INFO;
  }
}
