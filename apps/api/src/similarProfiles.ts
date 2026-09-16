import { computeInterestCompatibility } from "./interestCompatibility";

export interface SimilarProfile {
  author: string;
  similarity: number;
}

/**
 * Tinder's real "Show similar profiles based on a selected pattern"
 * (#284) — "pattern" is a real, already-collected signal (#79's interest
 * tags), not a fabricated ML embedding. Given a profile the viewer picked
 * as the pattern to match (`selectedAuthor`), other candidates are ranked
 * by how closely THEIR OWN interests match that SAME profile's, using the
 * exact #94 compatibility formula (`computeInterestCompatibility`) —
 * candidate-to-selected-profile similarity, not candidate-to-viewer. This
 * is genuinely different from #94's own swipe-card ordering (candidates
 * ranked by similarity to the viewer): here the viewer explicitly says
 * "show me more people like this one," and the pattern being matched is
 * whichever profile they selected, not their own profile.
 */
export function getSimilarProfiles(
  selectedInterests: string[],
  pool: { author: string; interests: string[] }[],
  excludeAuthor: string,
  limit = 10
): SimilarProfile[] {
  return pool
    .filter((candidate) => candidate.author !== excludeAuthor)
    .map((candidate) => ({ author: candidate.author, similarity: computeInterestCompatibility(selectedInterests, candidate.interests) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
