import { scanForContactInfo } from "./contactInfoDetector";
import { filterProfanity } from "./profanityFilter";

export const MAX_BIO_LENGTH = 280;

export type UpdateBioResult = { success: true; bio: string } | { success: false; error: string };

// Same phone-number/address rule onboarding.ts applies to the initial bio —
// reimplemented here rather than imported since onboarding's helper isn't
// exported (it's a private step-validation detail there).
function describeContactInfo(text: string): string | undefined {
  if (!text) return undefined;
  const scan = scanForContactInfo(text);
  if (scan.containsPhoneNumber && scan.containsAddress) return "can't contain a phone number or address";
  if (scan.containsPhoneNumber) return "can't contain a phone number";
  if (scan.containsAddress) return "can't contain an address";
  return undefined;
}

/**
 * Editable-anytime profile bio (#65) — same one-value-per-author,
 * replace-on-update shape as #61-64's photo/video/voice profile stores,
 * independent of the one-time bio collected during onboarding
 * (onboarding.ts) so a user can revise it afterward without re-running the
 * onboarding wizard.
 */
export class BioStore {
  private bioByAuthor = new Map<string, string>();

  update(author: unknown, bio: unknown): UpdateBioResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const text = typeof bio === "string" ? bio.trim() : "";

    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (text.length > MAX_BIO_LENGTH) {
      return { success: false, error: `bio must be ${MAX_BIO_LENGTH} characters or fewer` };
    }
    const contactInfoError = describeContactInfo(text);
    if (contactInfoError) {
      return { success: false, error: `bio ${contactInfoError}` };
    }

    // Bumble's real "Automatic filtering system for inappropriate words
    // and profanity" (#176): unlike #143's chat-message warning, a bio
    // update isn't rejected or held for confirmation — profanity is
    // silently masked so the profile is never left blocked mid-edit.
    const { filtered } = filterProfanity(text);

    this.bioByAuthor.set(authorName, filtered);
    return { success: true, bio: filtered };
  }

  get(author: string): string {
    return this.bioByAuthor.get(author) ?? "";
  }
}
