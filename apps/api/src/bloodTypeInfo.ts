// Real ABO/Rh blood types — the actual field some cultures (notably Japan
// and South Korea, where blood-type personality beliefs are mainstream)
// search dating profiles by.
export const BLOOD_TYPE_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodType = (typeof BLOOD_TYPE_OPTIONS)[number];

export interface BloodTypeInfo {
  bloodType: BloodType | null;
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#75/#301's other profile-detail hide flags.
  hideBloodType: boolean;
}

export type UpdateBloodTypeInfoResult =
  | { success: true; bloodTypeInfo: BloodTypeInfo }
  | { success: false; error: string };

export function isBloodType(value: unknown): value is BloodType {
  return typeof value === "string" && (BLOOD_TYPE_OPTIONS as readonly string[]).includes(value);
}

const EMPTY_BLOOD_TYPE_INFO: BloodTypeInfo = { bloodType: null, hideBloodType: false };

/**
 * Match.com's real "Ability to search by blood type (in some cultures)"
 * (#302), same one-value-per-author, replace-on-update shape as #301's
 * diet type — a single fixed-choice enum (a picker, not free text),
 * genuinely relevant in cultures (Japan, South Korea) where blood-type
 * personality beliefs are mainstream, not a fabricated field.
 */
export class BloodTypeInfoStore {
  private infoByAuthor = new Map<string, BloodTypeInfo>();

  update(author: unknown, bloodType: unknown, hideBloodType: unknown): UpdateBloodTypeInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let bloodTypeValue: BloodType | null = null;
    if (bloodType !== null && bloodType !== undefined) {
      if (!isBloodType(bloodType)) {
        return { success: false, error: `bloodType must be one of: ${BLOOD_TYPE_OPTIONS.join(", ")}` };
      }
      bloodTypeValue = bloodType;
    }

    const bloodTypeInfo: BloodTypeInfo = { bloodType: bloodTypeValue, hideBloodType: hideBloodType === true };
    this.infoByAuthor.set(authorName, bloodTypeInfo);
    return { success: true, bloodTypeInfo };
  }

  get(author: string): BloodTypeInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_BLOOD_TYPE_INFO;
  }
}
