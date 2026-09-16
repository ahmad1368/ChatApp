import { TargetCountry } from "./targetImmigrationCountry";

/**
 * Match.com's real "find a travel companion" for a shared immigration
 * goal (#325) — an exact match on a single fixed-catalog country, unlike
 * #118/#119's Spotify-track/weekend-plan overlap scoring, since a target
 * destination is a single choice, not a set to intersect.
 */
export function isSameTargetCountry(a: TargetCountry | null, b: TargetCountry | null): boolean {
  return a !== null && b !== null && a === b;
}
