export const MBTI_TYPES = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
] as const;
export type MbtiType = (typeof MBTI_TYPES)[number];

export const MIN_ENNEAGRAM_TYPE = 1;
export const MAX_ENNEAGRAM_TYPE = 9;

export interface PersonalityInfo {
  mbtiType: MbtiType | null;
  enneagramType: number | null;
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#75's other profile-detail hide flags, independent per field.
  hideMbti: boolean;
  hideEnneagram: boolean;
}

export type UpdatePersonalityInfoResult =
  | { success: true; personalityInfo: PersonalityInfo }
  | { success: false; error: string };

function isMbtiType(value: unknown): value is MbtiType {
  return typeof value === "string" && (MBTI_TYPES as readonly string[]).includes(value.toUpperCase());
}

const EMPTY_PERSONALITY_INFO: PersonalityInfo = {
  mbtiType: null,
  enneagramType: null,
  hideMbti: false,
  hideEnneagram: false,
};

/**
 * Editable-anytime personality type (#76): MBTI and Enneagram, same
 * one-value-per-author, replace-on-update shape as #67-#75's other
 * standalone profile fields. Both fields are optional fixed-choice values
 * (a 16-option enum and a 1-9 integer), each independently hideable.
 */
export class PersonalityInfoStore {
  private infoByAuthor = new Map<string, PersonalityInfo>();

  update(
    author: unknown,
    mbtiType: unknown,
    enneagramType: unknown,
    hideMbti: unknown,
    hideEnneagram: unknown
  ): UpdatePersonalityInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let mbtiValue: MbtiType | null = null;
    if (mbtiType !== null && mbtiType !== undefined) {
      if (!isMbtiType(mbtiType)) {
        return { success: false, error: `mbtiType must be one of: ${MBTI_TYPES.join(", ")}` };
      }
      mbtiValue = (mbtiType as string).toUpperCase() as MbtiType;
    }

    let enneagramValue: number | null = null;
    if (enneagramType !== null && enneagramType !== undefined) {
      if (
        typeof enneagramType !== "number" ||
        !Number.isInteger(enneagramType) ||
        enneagramType < MIN_ENNEAGRAM_TYPE ||
        enneagramType > MAX_ENNEAGRAM_TYPE
      ) {
        return { success: false, error: `enneagramType must be a whole number between ${MIN_ENNEAGRAM_TYPE} and ${MAX_ENNEAGRAM_TYPE}` };
      }
      enneagramValue = enneagramType;
    }

    const personalityInfo: PersonalityInfo = {
      mbtiType: mbtiValue,
      enneagramType: enneagramValue,
      hideMbti: hideMbti === true,
      hideEnneagram: hideEnneagram === true,
    };
    this.infoByAuthor.set(authorName, personalityInfo);
    return { success: true, personalityInfo };
  }

  get(author: string): PersonalityInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_PERSONALITY_INFO;
  }
}
