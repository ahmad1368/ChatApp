export const MIN_HEIGHT_CM = 100;
export const MAX_HEIGHT_CM = 250;

export interface HeightInfo {
  heightCm: number | null;
  // Same "show a detail while letting people hide it" privacy option as
  // #67's hideCompany and #68's hideSchool.
  hideHeight: boolean;
}

export type UpdateHeightInfoResult = { success: true; heightInfo: HeightInfo } | { success: false; error: string };

const EMPTY_HEIGHT_INFO: HeightInfo = { heightCm: null, hideHeight: false };

/**
 * Editable-anytime height (#69), same one-value-per-author,
 * replace-on-update shape as #67's job info and #68's education info. Height
 * is optional and stored in centimeters regardless of the unit the client
 * displays it in, avoiding imperial/metric ambiguity server-side.
 */
export class HeightInfoStore {
  private heightInfoByAuthor = new Map<string, HeightInfo>();

  update(author: unknown, heightCm: unknown, hideHeight: unknown): UpdateHeightInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const hide = hideHeight === true;

    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let height: number | null = null;
    if (heightCm !== null && heightCm !== undefined) {
      if (typeof heightCm !== "number" || !Number.isInteger(heightCm)) {
        return { success: false, error: "heightCm must be a whole number" };
      }
      if (heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) {
        return { success: false, error: `heightCm must be between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM}` };
      }
      height = heightCm;
    }

    const heightInfo: HeightInfo = { heightCm: height, hideHeight: hide };
    this.heightInfoByAuthor.set(authorName, heightInfo);
    return { success: true, heightInfo };
  }

  get(author: string): HeightInfo {
    return this.heightInfoByAuthor.get(author) ?? EMPTY_HEIGHT_INFO;
  }
}
