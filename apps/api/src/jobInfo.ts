import { scanForContactInfo } from "./contactInfoDetector";

export const MAX_JOB_TITLE_LENGTH = 100;
export const MAX_COMPANY_LENGTH = 100;

export interface JobInfo {
  jobTitle: string;
  company: string;
  // Hinge lets you show your job title while hiding the specific employer —
  // a real privacy consideration (e.g. not wanting to be easily found by
  // coworkers) that this app's other free-text profile fields don't need.
  hideCompany: boolean;
}

export type UpdateJobInfoResult = { success: true; jobInfo: JobInfo } | { success: false; error: string };

// Same phone-number/address rule onboarding.ts, bio.ts, and profilePrompts.ts
// apply to other free-text profile fields — reimplemented locally since it's
// a private detail in each of those, not a shared export.
function describeContactInfo(text: string): string | undefined {
  if (!text) return undefined;
  const scan = scanForContactInfo(text);
  if (scan.containsPhoneNumber && scan.containsAddress) return "can't contain a phone number or address";
  if (scan.containsPhoneNumber) return "can't contain a phone number";
  if (scan.containsAddress) return "can't contain an address";
  return undefined;
}

const EMPTY_JOB_INFO: JobInfo = { jobTitle: "", company: "", hideCompany: false };

/**
 * Editable-anytime job title + workplace (#67), same one-value-per-author,
 * replace-on-update shape as #65's bio and #66's profile prompts. Both
 * fields are optional, matching Hinge's real behavior of not requiring
 * either to complete a profile.
 */
export class JobInfoStore {
  private jobInfoByAuthor = new Map<string, JobInfo>();

  update(author: unknown, jobTitle: unknown, company: unknown, hideCompany: unknown): UpdateJobInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const title = typeof jobTitle === "string" ? jobTitle.trim() : "";
    const companyName = typeof company === "string" ? company.trim() : "";
    const hide = hideCompany === true;

    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (title.length > MAX_JOB_TITLE_LENGTH) {
      return { success: false, error: `jobTitle must be ${MAX_JOB_TITLE_LENGTH} characters or fewer` };
    }
    if (companyName.length > MAX_COMPANY_LENGTH) {
      return { success: false, error: `company must be ${MAX_COMPANY_LENGTH} characters or fewer` };
    }
    const jobTitleContactInfoError = describeContactInfo(title);
    if (jobTitleContactInfoError) {
      return { success: false, error: `jobTitle ${jobTitleContactInfoError}` };
    }
    const companyContactInfoError = describeContactInfo(companyName);
    if (companyContactInfoError) {
      return { success: false, error: `company ${companyContactInfoError}` };
    }

    const jobInfo: JobInfo = { jobTitle: title, company: companyName, hideCompany: hide };
    this.jobInfoByAuthor.set(authorName, jobInfo);
    return { success: true, jobInfo };
  }

  get(author: string): JobInfo {
    return this.jobInfoByAuthor.get(author) ?? EMPTY_JOB_INFO;
  }
}
