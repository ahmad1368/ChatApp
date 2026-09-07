export const RELIGION_OPTIONS = [
  "agnostic",
  "atheist",
  "buddhist",
  "catholic",
  "christian",
  "hindu",
  "jewish",
  "muslim",
  "sikh",
  "spiritual",
  "other",
] as const;
export type ReligionOption = (typeof RELIGION_OPTIONS)[number];

export const POLITICAL_VIEW_OPTIONS = ["liberal", "moderate", "conservative", "notPolitical", "other"] as const;
export type PoliticalViewOption = (typeof POLITICAL_VIEW_OPTIONS)[number];

export interface BeliefsInfo {
  religion: ReligionOption | null;
  politicalView: PoliticalViewOption | null;
  // Religion and political views are especially sensitive protected-category
  // data, so — even more than #67-#73's other hide flags — each is hidden
  // independently by default-off opt-in visibility, same mechanism, higher
  // stakes.
  hideReligion: boolean;
  hidePoliticalView: boolean;
}

export type UpdateBeliefsInfoResult = { success: true; beliefsInfo: BeliefsInfo } | { success: false; error: string };

function isReligionOption(value: unknown): value is ReligionOption {
  return typeof value === "string" && (RELIGION_OPTIONS as readonly string[]).includes(value);
}

function isPoliticalViewOption(value: unknown): value is PoliticalViewOption {
  return typeof value === "string" && (POLITICAL_VIEW_OPTIONS as readonly string[]).includes(value);
}

const EMPTY_BELIEFS_INFO: BeliefsInfo = {
  religion: null,
  politicalView: null,
  hideReligion: false,
  hidePoliticalView: false,
};

/**
 * Editable-anytime religion/political-views (#74), same
 * one-value-per-author, replace-on-update shape as #67-#73's other
 * standalone profile fields. Both are optional fixed-choice enums (a
 * picker, not free text), each independently hideable.
 */
export class BeliefsInfoStore {
  private infoByAuthor = new Map<string, BeliefsInfo>();

  update(
    author: unknown,
    religion: unknown,
    politicalView: unknown,
    hideReligion: unknown,
    hidePoliticalView: unknown
  ): UpdateBeliefsInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let religionValue: ReligionOption | null = null;
    if (religion !== null && religion !== undefined) {
      if (!isReligionOption(religion)) {
        return { success: false, error: `religion must be one of: ${RELIGION_OPTIONS.join(", ")}` };
      }
      religionValue = religion;
    }

    let politicalViewValue: PoliticalViewOption | null = null;
    if (politicalView !== null && politicalView !== undefined) {
      if (!isPoliticalViewOption(politicalView)) {
        return { success: false, error: `politicalView must be one of: ${POLITICAL_VIEW_OPTIONS.join(", ")}` };
      }
      politicalViewValue = politicalView;
    }

    const beliefsInfo: BeliefsInfo = {
      religion: religionValue,
      politicalView: politicalViewValue,
      hideReligion: hideReligion === true,
      hidePoliticalView: hidePoliticalView === true,
    };
    this.infoByAuthor.set(authorName, beliefsInfo);
    return { success: true, beliefsInfo };
  }

  get(author: string): BeliefsInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_BELIEFS_INFO;
  }
}
