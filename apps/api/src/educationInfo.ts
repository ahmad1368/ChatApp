import { scanForContactInfo } from "./contactInfoDetector";

export const MAX_SCHOOL_LENGTH = 100;

export interface EducationInfo {
  school: string;
  // Hinge lets you show you attended a school while hiding which one — the
  // same privacy option #67's JobInfoStore models for company/employer.
  hideSchool: boolean;
}

export type UpdateEducationInfoResult =
  | { success: true; educationInfo: EducationInfo }
  | { success: false; error: string };

// Same phone-number/address rule onboarding.ts, bio.ts, profilePrompts.ts,
// and jobInfo.ts apply to other free-text profile fields — reimplemented
// locally since it's a private detail in each of those, not a shared export.
function describeContactInfo(text: string): string | undefined {
  if (!text) return undefined;
  const scan = scanForContactInfo(text);
  if (scan.containsPhoneNumber && scan.containsAddress) return "can't contain a phone number or address";
  if (scan.containsPhoneNumber) return "can't contain a phone number";
  if (scan.containsAddress) return "can't contain an address";
  return undefined;
}

const EMPTY_EDUCATION_INFO: EducationInfo = { school: "", hideSchool: false };

/**
 * Editable-anytime school/university (#68), same one-value-per-author,
 * replace-on-update shape as #67's job info. The field is optional,
 * matching Hinge's real behavior of not requiring it to complete a profile.
 */
export class EducationInfoStore {
  private educationInfoByAuthor = new Map<string, EducationInfo>();

  update(author: unknown, school: unknown, hideSchool: unknown): UpdateEducationInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const schoolName = typeof school === "string" ? school.trim() : "";
    const hide = hideSchool === true;

    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (schoolName.length > MAX_SCHOOL_LENGTH) {
      return { success: false, error: `school must be ${MAX_SCHOOL_LENGTH} characters or fewer` };
    }
    const contactInfoError = describeContactInfo(schoolName);
    if (contactInfoError) {
      return { success: false, error: `school ${contactInfoError}` };
    }

    const educationInfo: EducationInfo = { school: schoolName, hideSchool: hide };
    this.educationInfoByAuthor.set(authorName, educationInfo);
    return { success: true, educationInfo };
  }

  get(author: string): EducationInfo {
    return this.educationInfoByAuthor.get(author) ?? EMPTY_EDUCATION_INFO;
  }
}
