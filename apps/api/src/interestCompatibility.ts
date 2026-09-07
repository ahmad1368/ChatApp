/**
 * OkCupid's real percentage-based compatibility score (#94), computed here
 * from #79's interest tags rather than a full questionnaire — this app has
 * no answered-questions system for OkCupid's actual match-percentage
 * algorithm to run on, so interests are the closest real signal already
 * collected. "Interest vector average" (the issue's own title) is treated
 * literally: each profile's interests are a binary vector over the fixed
 * catalog, and the score is the shared-interest count divided by the
 * average of the two vectors' magnitudes — 100% when two profiles share
 * every interest they each listed, 0% when they share none or either has
 * none listed.
 */
export function computeInterestCompatibility(interestsA: string[], interestsB: string[]): number {
  const setA = new Set(interestsA);
  const setB = new Set(interestsB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const interest of setA) {
    if (setB.has(interest)) shared += 1;
  }

  const averageVectorSize = (setA.size + setB.size) / 2;
  return Math.round((shared / averageVectorSize) * 100);
}
