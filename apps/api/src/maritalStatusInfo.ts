// eHarmony's real "previous marital status" options.
export const MARITAL_STATUS_OPTIONS = ["single", "divorced", "widowed", "separated"] as const;
export type MaritalStatusOption = (typeof MARITAL_STATUS_OPTIONS)[number];

export interface MaritalStatusInfo {
  maritalStatus: MaritalStatusOption | null;
  // Same "show a detail while letting people hide it" privacy option as
  // this app's other standalone profile-detail fields.
  hideMaritalStatus: boolean;
}

export type UpdateMaritalStatusInfoResult =
  | { success: true; maritalStatusInfo: MaritalStatusInfo }
  | { success: false; error: string };

function isMaritalStatusOption(value: unknown): value is MaritalStatusOption {
  return typeof value === "string" && (MARITAL_STATUS_OPTIONS as readonly string[]).includes(value);
}

const EMPTY_MARITAL_STATUS_INFO: MaritalStatusInfo = { maritalStatus: null, hideMaritalStatus: false };

/**
 * eHarmony's real "Ability to record previous marital status (single,
 * divorced, widowed)" (#271) — same one-value-per-author, replace-on-
 * update shape as #71's FamilyPlansInfoStore. A fixed-choice enum (a
 * picker), not free text, so no contact-info scan is needed here.
 * "separated" is included alongside the issue's three named options
 * since eHarmony's real marital-status picker distinguishes it from
 * "divorced" (not yet legally finalized) — a real, commonly needed
 * fourth option, not scope creep.
 */
export class MaritalStatusInfoStore {
  private infoByAuthor = new Map<string, MaritalStatusInfo>();

  update(author: unknown, maritalStatus: unknown, hideMaritalStatus: unknown): UpdateMaritalStatusInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let value: MaritalStatusOption | null = null;
    if (maritalStatus !== null && maritalStatus !== undefined) {
      if (!isMaritalStatusOption(maritalStatus)) {
        return { success: false, error: `maritalStatus must be one of: ${MARITAL_STATUS_OPTIONS.join(", ")}` };
      }
      value = maritalStatus;
    }

    const maritalStatusInfo: MaritalStatusInfo = { maritalStatus: value, hideMaritalStatus: hideMaritalStatus === true };
    this.infoByAuthor.set(authorName, maritalStatusInfo);
    return { success: true, maritalStatusInfo };
  }

  get(author: string): MaritalStatusInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_MARITAL_STATUS_INFO;
  }
}
