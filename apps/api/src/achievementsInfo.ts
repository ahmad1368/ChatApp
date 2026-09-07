import { scanForContactInfo } from "./contactInfoDetector";

export const MAX_ACHIEVEMENTS = 5;
export const MAX_TITLE_LENGTH = 100;
export const MAX_ISSUER_LENGTH = 100;
const MIN_YEAR = 1950;

export interface Achievement {
  title: string;
  issuer: string;
  year: number | null;
}

export interface AchievementsInfo {
  achievements: Achievement[];
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#86's other profile-detail hide flags.
  hideAchievements: boolean;
}

export type UpdateAchievementsInfoResult =
  | { success: true; achievementsInfo: AchievementsInfo }
  | { success: false; error: string };

// Same phone-number/address rule onboarding.ts, bio.ts, and other free-text
// profile fields apply — reimplemented locally since it's a private detail
// in each of those, not a shared export.
function describeContactInfo(text: string): string | undefined {
  if (!text) return undefined;
  const scan = scanForContactInfo(text);
  if (scan.containsPhoneNumber && scan.containsAddress) return "can't contain a phone number or address";
  if (scan.containsPhoneNumber) return "can't contain a phone number";
  if (scan.containsAddress) return "can't contain an address";
  return undefined;
}

function currentYear(): number {
  return new Date().getFullYear();
}

const EMPTY_ACHIEVEMENTS_INFO: AchievementsInfo = { achievements: [], hideAchievements: false };

/**
 * Editable-anytime "official achievements" list (#87) — degrees,
 * certifications, awards, entered as short text rather than an uploaded
 * document. Same one-value-per-author, replace-on-update shape as #67-#86's
 * other standalone profile fields.
 *
 * The issue also offers "resume documents" as an alternative format; that's
 * deliberately out of scope here. A resume PDF is far more PII-dense (full
 * name, address, phone, full employment history, references) than any
 * other upload this app accepts, and this codebase has no malware/content
 * scanning for arbitrary document uploads (only image re-encoding via
 * #82's photoOptimization, which doesn't apply to PDFs) — accepting one
 * without that infrastructure would be a real safety regression, not a
 * feature. The achievements list captures the same "credibility" intent
 * Match.com's reference pattern is going for without that risk.
 */
export class AchievementsInfoStore {
  private infoByAuthor = new Map<string, AchievementsInfo>();

  update(author: unknown, achievements: unknown, hideAchievements: unknown): UpdateAchievementsInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!Array.isArray(achievements)) {
      return { success: false, error: "achievements must be a list" };
    }
    if (achievements.length > MAX_ACHIEVEMENTS) {
      return { success: false, error: `Choose at most ${MAX_ACHIEVEMENTS} achievements` };
    }

    const validated: Achievement[] = [];
    for (const entry of achievements) {
      const rawTitle = typeof entry === "object" && entry !== null ? (entry as { title?: unknown }).title : undefined;
      const rawIssuer = typeof entry === "object" && entry !== null ? (entry as { issuer?: unknown }).issuer : undefined;
      const rawYear = typeof entry === "object" && entry !== null ? (entry as { year?: unknown }).year : undefined;

      const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
      if (!title) {
        return { success: false, error: "Each achievement needs a title" };
      }
      if (title.length > MAX_TITLE_LENGTH) {
        return { success: false, error: `title must be ${MAX_TITLE_LENGTH} characters or fewer` };
      }
      const titleContactInfoError = describeContactInfo(title);
      if (titleContactInfoError) {
        return { success: false, error: `title ${titleContactInfoError}` };
      }

      const issuer = typeof rawIssuer === "string" ? rawIssuer.trim() : "";
      if (issuer.length > MAX_ISSUER_LENGTH) {
        return { success: false, error: `issuer must be ${MAX_ISSUER_LENGTH} characters or fewer` };
      }
      const issuerContactInfoError = describeContactInfo(issuer);
      if (issuerContactInfoError) {
        return { success: false, error: `issuer ${issuerContactInfoError}` };
      }

      let year: number | null = null;
      if (rawYear !== null && rawYear !== undefined) {
        if (typeof rawYear !== "number" || !Number.isInteger(rawYear) || rawYear < MIN_YEAR || rawYear > currentYear()) {
          return { success: false, error: `year must be a whole number between ${MIN_YEAR} and ${currentYear()}` };
        }
        year = rawYear;
      }

      validated.push({ title, issuer, year });
    }

    const achievementsInfo: AchievementsInfo = { achievements: validated, hideAchievements: hideAchievements === true };
    this.infoByAuthor.set(authorName, achievementsInfo);
    return { success: true, achievementsInfo };
  }

  get(author: string): AchievementsInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_ACHIEVEMENTS_INFO;
  }
}
