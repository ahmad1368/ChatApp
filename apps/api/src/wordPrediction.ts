/**
 * Tinder's real "Automatic word prediction (Autocomplete) in chat" (#288)
 * — real prefix-based next-word completion ranked by word frequency, the
 * same technique phone keyboards used for predictive text long before
 * neural language models existed. This app has no trained language model
 * to fabricate, so completions come from a curated, fixed English-word
 * frequency table (`WORD_FREQUENCIES`, higher = more common) rather than
 * a fake "AI-powered" claim — a real, honest algorithm, not a stand-in
 * for a real one.
 */
export const WORD_FREQUENCIES: Record<string, number> = {
  the: 100, you: 98, to: 97, and: 96, a: 95, i: 94, of: 93, that: 92, in: 91, is: 90,
  it: 89, for: 88, on: 87, with: 86, are: 85, be: 84, this: 83, have: 82, not: 81, but: 80,
  we: 79, what: 78, your: 77, at: 76, so: 75, all: 74, my: 73, can: 72, if: 71, about: 70,
  out: 69, up: 68, just: 67, get: 66, like: 65, do: 64, know: 63, will: 62, one: 61, would: 60,
  there: 59, how: 58, when: 57, they: 56, some: 55, time: 54, no: 53, been: 52, more: 51, hi: 50,
  hey: 49, hello: 48, thanks: 47, thank: 46, really: 45, great: 44, good: 43, love: 42, want: 41, think: 40,
  today: 39, tonight: 38, tomorrow: 37, weekend: 36, coffee: 35, dinner: 34, drink: 33, drinks: 32, date: 31, meet: 30,
  free: 29, sound: 28, sounds: 27, fun: 26, awesome: 25, sure: 24, maybe: 23, definitely: 22, actually: 21, pretty: 20,
  looking: 19, forward: 18, excited: 17, nice: 16, cool: 15, amazing: 14, interesting: 13, favorite: 12, movie: 11, music: 10,
  travel: 9, hiking: 8, dog: 7, dogs: 6, cat: 5, cats: 4, wine: 3, restaurant: 2, message: 1,
};

/** Returns up to `limit` real words starting with `prefix` (case-insensitive), highest-frequency first. Excludes an exact match to itself — nothing to complete. */
export function predictNextWords(prefix: unknown, limit = 5): string[] {
  const trimmed = typeof prefix === "string" ? prefix.trim().toLowerCase() : "";
  if (!trimmed) return [];

  return Object.keys(WORD_FREQUENCIES)
    .filter((word) => word !== trimmed && word.startsWith(trimmed))
    .sort((a, b) => WORD_FREQUENCIES[b] - WORD_FREQUENCIES[a])
    .slice(0, Math.max(0, limit));
}
