import { scanForContactInfo } from "./contactInfoDetector";
import { filterProfanity } from "./profanityFilter";

export const DISPLAY_NAME_MODES = ["fullName", "firstNameOnly", "initials", "nickname"] as const;
export type DisplayNameMode = (typeof DISPLAY_NAME_MODES)[number];

export const MAX_NICKNAME_LENGTH = 40;

export interface DisplayNamePreference {
  mode: DisplayNameMode;
  nickname: string;
}

export type UpdateDisplayNamePreferenceResult =
  | { success: true; preference: DisplayNamePreference }
  | { success: false; error: string };

function isDisplayNameMode(value: unknown): value is DisplayNameMode {
  return typeof value === "string" && (DISPLAY_NAME_MODES as readonly string[]).includes(value);
}

// Same phone-number/address rule onboarding.ts's displayName step and
// bio.ts apply to other free-text profile fields — reimplemented locally
// since it's a private detail in each of those, not a shared export.
function describeContactInfo(text: string): string | undefined {
  if (!text) return undefined;
  const scan = scanForContactInfo(text);
  if (scan.containsPhoneNumber && scan.containsAddress) return "can't contain a phone number or address";
  if (scan.containsPhoneNumber) return "can't contain a phone number";
  if (scan.containsAddress) return "can't contain an address";
  return undefined;
}

const DEFAULT_PREFERENCE: DisplayNamePreference = { mode: "fullName", nickname: "" };

/**
 * Editable-anytime display-name mode (#88) — how the name #21's onboarding
 * (displayName step) collected is actually rendered to other users: as
 * entered, first name only, initials, or a separate nickname override.
 * Same one-value-per-author, replace-on-update shape as #67-#87's other
 * standalone profile fields, independent of onboarding.ts (same
 * relationship #65's BioStore has to onboarding's own bio step).
 */
export class DisplayNameModeStore {
  private preferenceByAuthor = new Map<string, DisplayNamePreference>();

  update(author: unknown, mode: unknown, nickname: unknown): UpdateDisplayNamePreferenceResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!isDisplayNameMode(mode)) {
      return { success: false, error: `mode must be one of: ${DISPLAY_NAME_MODES.join(", ")}` };
    }

    const nicknameValue = typeof nickname === "string" ? nickname.trim() : "";
    if (nicknameValue.length > MAX_NICKNAME_LENGTH) {
      return { success: false, error: `nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer` };
    }
    const contactInfoError = describeContactInfo(nicknameValue);
    if (contactInfoError) {
      return { success: false, error: `nickname ${contactInfoError}` };
    }
    if (mode === "nickname" && !nicknameValue) {
      return { success: false, error: "nickname is required when mode is \"nickname\"" };
    }

    // #176's automatic profanity filter — same silent masking as bio.ts,
    // since a display name is shown to other users everywhere, not just
    // in chat where #143's interactive warning already applies.
    const { filtered: filteredNickname } = filterProfanity(nicknameValue);
    const preference: DisplayNamePreference = { mode, nickname: filteredNickname };
    this.preferenceByAuthor.set(authorName, preference);
    return { success: true, preference };
  }

  get(author: string): DisplayNamePreference {
    return this.preferenceByAuthor.get(author) ?? DEFAULT_PREFERENCE;
  }
}

/**
 * Resolves a stored full display name down to the string other users
 * actually see, per the author's DisplayNamePreference. Pure so it's
 * trivial to unit test independent of the store.
 */
export function resolveDisplayName(fullName: string, preference: DisplayNamePreference): string {
  const trimmedFullName = fullName.trim();
  switch (preference.mode) {
    case "fullName":
      return trimmedFullName;
    case "firstNameOnly":
      return trimmedFullName.split(/\s+/)[0] ?? "";
    case "initials":
      return trimmedFullName
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("");
    case "nickname":
      return preference.nickname || trimmedFullName;
  }
}
