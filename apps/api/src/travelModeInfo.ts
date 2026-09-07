import { scanForContactInfo } from "./contactInfoDetector";

export const MAX_DESTINATION_LENGTH = 80;

export interface TravelModeInfo {
  active: boolean;
  destination: string;
}

export type UpdateTravelModeInfoResult =
  | { success: true; travelModeInfo: TravelModeInfo }
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

const EMPTY_TRAVEL_MODE_INFO: TravelModeInfo = { active: false, destination: "" };

/**
 * Editable-anytime "work/travel mode" (#84) — Tinder Passport/Bumble Travel
 * Mode's real "I'm temporarily somewhere else" status, shown on the profile
 * while active. Same one-value-per-author, replace-on-update shape as
 * #67-#83's other standalone profile fields; unlike those, the "hide" and
 * "value" concepts are the same toggle here (there's nothing to show when
 * inactive), so there's no separate hide flag.
 */
export class TravelModeInfoStore {
  private infoByAuthor = new Map<string, TravelModeInfo>();

  update(author: unknown, active: unknown, destination: unknown): UpdateTravelModeInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const destinationValue = typeof destination === "string" ? destination.trim() : "";
    if (destinationValue.length > MAX_DESTINATION_LENGTH) {
      return { success: false, error: `destination must be ${MAX_DESTINATION_LENGTH} characters or fewer` };
    }
    const contactInfoError = describeContactInfo(destinationValue);
    if (contactInfoError) {
      return { success: false, error: `destination ${contactInfoError}` };
    }

    const travelModeInfo: TravelModeInfo = { active: active === true, destination: destinationValue };
    this.infoByAuthor.set(authorName, travelModeInfo);
    return { success: true, travelModeInfo };
  }

  get(author: string): TravelModeInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_TRAVEL_MODE_INFO;
  }
}
