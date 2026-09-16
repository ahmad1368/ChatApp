// A representative fixed catalog of popular immigration destinations —
// same "representative catalog, not a full ISO country list" scoping call
// as #73's languages/#79's interests, so exact matches between two
// people are actually possible (free text would fragment "USA" vs
// "United States" vs "US" into non-matching entries).
export const TARGET_COUNTRY_CATALOG = [
  "canada",
  "unitedStates",
  "unitedKingdom",
  "australia",
  "newZealand",
  "germany",
  "netherlands",
  "ireland",
  "sweden",
  "switzerland",
  "singapore",
  "japan",
  "southKorea",
  "unitedArabEmirates",
  "spain",
  "portugal",
  "italy",
  "france",
  "mexico",
  "brazil",
] as const;
export type TargetCountry = (typeof TARGET_COUNTRY_CATALOG)[number];

export interface TargetImmigrationCountryInfo {
  targetCountry: TargetCountry | null;
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#84's other profile-detail hide flags.
  hideTargetCountry: boolean;
}

export type UpdateTargetImmigrationCountryResult =
  | { success: true; info: TargetImmigrationCountryInfo }
  | { success: false; error: string };

function isTargetCountry(value: unknown): value is TargetCountry {
  return typeof value === "string" && (TARGET_COUNTRY_CATALOG as readonly string[]).includes(value);
}

const EMPTY_INFO: TargetImmigrationCountryInfo = { targetCountry: null, hideTargetCountry: false };

/**
 * Match.com's real "Ability to select a target immigration country to
 * find a travel companion" (#325) — a single, fixed-catalog destination
 * an author is planning to move to, same one-value-per-author, replace-
 * on-update shape as #67-#84's other standalone profile fields. Distinct
 * from #84's TravelModeInfoStore (a *current* "I'm temporarily elsewhere"
 * toggle): this is a *future* immigration goal, matched against other
 * authors targeting the exact same country (see
 * targetImmigrationCountryMatch.ts) to find a real travel companion for
 * that specific move.
 */
export class TargetImmigrationCountryStore {
  private infoByAuthor = new Map<string, TargetImmigrationCountryInfo>();

  update(author: unknown, targetCountry: unknown, hideTargetCountry: unknown): UpdateTargetImmigrationCountryResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let country: TargetCountry | null = null;
    if (targetCountry !== null && targetCountry !== undefined) {
      if (!isTargetCountry(targetCountry)) {
        return { success: false, error: `targetCountry must be one of: ${TARGET_COUNTRY_CATALOG.join(", ")}` };
      }
      country = targetCountry;
    }

    const info: TargetImmigrationCountryInfo = { targetCountry: country, hideTargetCountry: hideTargetCountry === true };
    this.infoByAuthor.set(authorName, info);
    return { success: true, info };
  }

  get(author: string): TargetImmigrationCountryInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_INFO;
  }
}
