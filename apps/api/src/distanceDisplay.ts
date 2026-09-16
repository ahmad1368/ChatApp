import { Coordinates, haversineDistanceKm } from "./locationPrivacy";

/**
 * Feeld's real "Ability to hide geographic distance from others" (#270)
 * — the missing other half of #80's `ProfileVisibilityStore.hideDistance`
 * toggle, which existed with no distance value to actually hide (see
 * profilePreview.ts's own doc comment disclosing that gap). Computed and
 * injected at the route level rather than living inside SwipeStore, same
 * reasoning #94's interest-compatibility scorer already uses. Returns
 * null (not just a hidden number) whenever the candidate has hidden
 * their distance or either side's location is unknown, so the client
 * can render "distance not shown" by checking for the field's absence.
 */
export function computeDisplayDistanceKm(
  viewerLocation: Coordinates | null,
  candidateLocation: Coordinates | null,
  candidateHidesDistance: boolean
): number | null {
  if (candidateHidesDistance || !viewerLocation || !candidateLocation) {
    return null;
  }
  return Math.round(haversineDistanceKm(viewerLocation, candidateLocation));
}
