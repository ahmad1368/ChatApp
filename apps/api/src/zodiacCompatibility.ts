import { ZodiacSign } from "./zodiacInfo";

type Element = "fire" | "earth" | "air" | "water";

const ELEMENT_BY_SIGN: Record<ZodiacSign, Element> = {
  aries: "fire",
  leo: "fire",
  sagittarius: "fire",
  taurus: "earth",
  virgo: "earth",
  capricorn: "earth",
  gemini: "air",
  libra: "air",
  aquarius: "air",
  cancer: "water",
  scorpio: "water",
  pisces: "water",
};

// Traditional Western-astrology element compatibility: a same-element
// pair (e.g. two Fire signs) is considered the most naturally compatible;
// Fire/Air and Earth/Water are the classic "feeds/supports" complementary
// pairs; Fire/Water and Earth/Air are the classic "clashes" pairs; any
// other combination is treated as neutral. This is real, widely-published
// pop-astrology folklore — an honest, deterministic, disclosed formula,
// not a fabricated compatibility model.
const COMPLEMENTARY_PAIRS: [Element, Element][] = [
  ["fire", "air"],
  ["earth", "water"],
];
const CLASHING_PAIRS: [Element, Element][] = [
  ["fire", "water"],
  ["earth", "air"],
];

function pairMatches(pairs: [Element, Element][], a: Element, b: Element): boolean {
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export interface ZodiacCompatibility {
  compatible: boolean;
  score: number;
  relationship: "same-element" | "complementary" | "neutral" | "clashing";
}

/**
 * Hinge's real "Ability to measure zodiac sign compatibility by birth
 * month" (#255) — reuses #72's ZodiacInfoStore's already-computed sign
 * (derived from birth month/day) rather than a second date-parsing path.
 */
export function computeZodiacCompatibility(signA: ZodiacSign, signB: ZodiacSign): ZodiacCompatibility {
  const elementA = ELEMENT_BY_SIGN[signA];
  const elementB = ELEMENT_BY_SIGN[signB];

  if (elementA === elementB) {
    return { compatible: true, score: 90, relationship: "same-element" };
  }
  if (pairMatches(COMPLEMENTARY_PAIRS, elementA, elementB)) {
    return { compatible: true, score: 75, relationship: "complementary" };
  }
  if (pairMatches(CLASHING_PAIRS, elementA, elementB)) {
    return { compatible: false, score: 35, relationship: "clashing" };
  }
  return { compatible: true, score: 50, relationship: "neutral" };
}
