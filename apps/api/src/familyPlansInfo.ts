// Hinge's real "Family plans" options.
export const FAMILY_PLANS_OPTIONS = ["dontWantChildren", "wantChildren", "openToChildren", "notSureYet"] as const;
export type FamilyPlansOption = (typeof FAMILY_PLANS_OPTIONS)[number];

export interface FamilyPlansInfo {
  familyPlans: FamilyPlansOption | null;
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#70's other profile-detail hide flags.
  hideFamilyPlans: boolean;
}

export type UpdateFamilyPlansInfoResult =
  | { success: true; familyPlansInfo: FamilyPlansInfo }
  | { success: false; error: string };

function isFamilyPlansOption(value: unknown): value is FamilyPlansOption {
  return typeof value === "string" && (FAMILY_PLANS_OPTIONS as readonly string[]).includes(value);
}

const EMPTY_FAMILY_PLANS_INFO: FamilyPlansInfo = { familyPlans: null, hideFamilyPlans: false };

/**
 * Editable-anytime family/children plans (#71), same one-value-per-author,
 * replace-on-update shape as #67-#70's other standalone profile fields. A
 * fixed-choice enum (a picker), not free text, so no contact-info scan is
 * needed here.
 */
export class FamilyPlansInfoStore {
  private infoByAuthor = new Map<string, FamilyPlansInfo>();

  update(author: unknown, familyPlans: unknown, hideFamilyPlans: unknown): UpdateFamilyPlansInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let value: FamilyPlansOption | null = null;
    if (familyPlans !== null && familyPlans !== undefined) {
      if (!isFamilyPlansOption(familyPlans)) {
        return { success: false, error: `familyPlans must be one of: ${FAMILY_PLANS_OPTIONS.join(", ")}` };
      }
      value = familyPlans;
    }

    const familyPlansInfo: FamilyPlansInfo = { familyPlans: value, hideFamilyPlans: hideFamilyPlans === true };
    this.infoByAuthor.set(authorName, familyPlansInfo);
    return { success: true, familyPlansInfo };
  }

  get(author: string): FamilyPlansInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_FAMILY_PLANS_INFO;
  }
}
