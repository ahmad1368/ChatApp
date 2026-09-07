export const ZODIAC_SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const;
export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface ZodiacInfo {
  birthMonth: number | null;
  birthDay: number | null;
  zodiacSign: ZodiacSign | null;
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#71's other profile-detail hide flags.
  hideZodiac: boolean;
}

export type UpdateZodiacInfoResult = { success: true; zodiacInfo: ZodiacInfo } | { success: false; error: string };

// Standard tropical zodiac date ranges. Only month/day (no year) are
// collected, since the sign doesn't depend on birth year and this app has
// no date-of-birth field to derive it from elsewhere.
function computeZodiacSign(month: number, day: number): ZodiacSign {
  const cutoffs: [number, number, ZodiacSign][] = [
    [1, 19, "capricorn"],
    [2, 18, "aquarius"],
    [3, 20, "pisces"],
    [4, 19, "aries"],
    [5, 20, "taurus"],
    [6, 20, "gemini"],
    [7, 22, "cancer"],
    [8, 22, "leo"],
    [9, 22, "virgo"],
    [10, 22, "libra"],
    [11, 21, "scorpio"],
    [12, 21, "sagittarius"],
  ];
  for (const [cutoffMonth, cutoffDay, sign] of cutoffs) {
    if (month === cutoffMonth && day <= cutoffDay) return sign;
    if (month < cutoffMonth) return sign;
  }
  return "capricorn";
}

const EMPTY_ZODIAC_INFO: ZodiacInfo = { birthMonth: null, birthDay: null, zodiacSign: null, hideZodiac: false };

/**
 * Editable-anytime zodiac sign (#72), derived server-side from a
 * month/day pair the profile provides — same one-value-per-author,
 * replace-on-update shape as #67-#71's other standalone profile fields.
 * Both fields are optional together (clearing one clears the sign too).
 */
export class ZodiacInfoStore {
  private infoByAuthor = new Map<string, ZodiacInfo>();

  update(author: unknown, birthMonth: unknown, birthDay: unknown, hideZodiac: unknown): UpdateZodiacInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    if (birthMonth === null || birthMonth === undefined) {
      const zodiacInfo: ZodiacInfo = { birthMonth: null, birthDay: null, zodiacSign: null, hideZodiac: hideZodiac === true };
      this.infoByAuthor.set(authorName, zodiacInfo);
      return { success: true, zodiacInfo };
    }

    if (typeof birthMonth !== "number" || !Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) {
      return { success: false, error: "birthMonth must be a whole number between 1 and 12" };
    }
    if (typeof birthDay !== "number" || !Number.isInteger(birthDay) || birthDay < 1 || birthDay > DAYS_IN_MONTH[birthMonth - 1]) {
      return { success: false, error: `birthDay must be a whole number between 1 and ${DAYS_IN_MONTH[birthMonth - 1]} for that month` };
    }

    const zodiacInfo: ZodiacInfo = {
      birthMonth,
      birthDay,
      zodiacSign: computeZodiacSign(birthMonth, birthDay),
      hideZodiac: hideZodiac === true,
    };
    this.infoByAuthor.set(authorName, zodiacInfo);
    return { success: true, zodiacInfo };
  }

  get(author: string): ZodiacInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_ZODIAC_INFO;
  }
}
