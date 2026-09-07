export const SMOKING_OPTIONS = ["no", "sometimes", "yes"] as const;
export type SmokingOption = (typeof SMOKING_OPTIONS)[number];

export const DRINKING_OPTIONS = ["no", "sometimes", "yes", "onSpecialOccasions"] as const;
export type DrinkingOption = (typeof DRINKING_OPTIONS)[number];

export interface LifestyleInfo {
  smoking: SmokingOption | null;
  drinking: DrinkingOption | null;
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#69's hideCompany/hideSchool/hideHeight — smoking/drinking status is
  // sensitive enough that Hinge lets each be hidden independently.
  hideSmoking: boolean;
  hideDrinking: boolean;
}

export type UpdateLifestyleInfoResult =
  | { success: true; lifestyleInfo: LifestyleInfo }
  | { success: false; error: string };

function isSmokingOption(value: unknown): value is SmokingOption {
  return typeof value === "string" && (SMOKING_OPTIONS as readonly string[]).includes(value);
}

function isDrinkingOption(value: unknown): value is DrinkingOption {
  return typeof value === "string" && (DRINKING_OPTIONS as readonly string[]).includes(value);
}

const EMPTY_LIFESTYLE_INFO: LifestyleInfo = { smoking: null, drinking: null, hideSmoking: false, hideDrinking: false };

/**
 * Editable-anytime smoking/drinking status (#70), same one-value-per-author,
 * replace-on-update shape as #67-#69's job/education/height info. Both
 * fields are optional fixed-choice enums (matching Hinge's real UI — a
 * picker, not free text) rather than open text, so no contact-info scan is
 * needed here.
 */
export class LifestyleInfoStore {
  private lifestyleInfoByAuthor = new Map<string, LifestyleInfo>();

  update(author: unknown, smoking: unknown, drinking: unknown, hideSmoking: unknown, hideDrinking: unknown): UpdateLifestyleInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let smokingValue: SmokingOption | null = null;
    if (smoking !== null && smoking !== undefined) {
      if (!isSmokingOption(smoking)) {
        return { success: false, error: `smoking must be one of: ${SMOKING_OPTIONS.join(", ")}` };
      }
      smokingValue = smoking;
    }

    let drinkingValue: DrinkingOption | null = null;
    if (drinking !== null && drinking !== undefined) {
      if (!isDrinkingOption(drinking)) {
        return { success: false, error: `drinking must be one of: ${DRINKING_OPTIONS.join(", ")}` };
      }
      drinkingValue = drinking;
    }

    const lifestyleInfo: LifestyleInfo = {
      smoking: smokingValue,
      drinking: drinkingValue,
      hideSmoking: hideSmoking === true,
      hideDrinking: hideDrinking === true,
    };
    this.lifestyleInfoByAuthor.set(authorName, lifestyleInfo);
    return { success: true, lifestyleInfo };
  }

  get(author: string): LifestyleInfo {
    return this.lifestyleInfoByAuthor.get(author) ?? EMPTY_LIFESTYLE_INFO;
  }
}
