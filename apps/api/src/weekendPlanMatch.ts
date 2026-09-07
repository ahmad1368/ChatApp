import { computeInterestCompatibility } from "./interestCompatibility";

export interface WeekendPlanMatch {
  sharedPlans: string[];
  compatibility: number;
}

/**
 * Tinder/Hinge's real "what are you up to this weekend" suggestion (#119),
 * same shape as #118's musicMatch.ts applied to #79's interest tags: reuses
 * #94's generic percentage-overlap formula rather than a second scoring
 * algorithm, and surfaces WHICH weekend plans two people have in common —
 * a concrete conversation opener, not just a score.
 */
export function computeWeekendPlanMatch(plansA: string[], plansB: string[]): WeekendPlanMatch {
  const setB = new Set(plansB);
  const sharedPlans = plansA.filter((plan) => setB.has(plan));
  return { sharedPlans, compatibility: computeInterestCompatibility(plansA, plansB) };
}
