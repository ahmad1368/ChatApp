import { computeInterestCompatibility } from "./interestCompatibility";

export interface MusicMatch {
  sharedTracks: string[];
  compatibility: number;
}

/**
 * Hinge's real "you both like X" shared-interest framing (#118), applied
 * here to #77's Spotify top tracks instead of #79's interest tags —
 * surfaces WHICH songs two people have in common rather than a bare
 * score, and reuses #94's percentage-overlap formula (`computeInterest
 * Compatibility` is generic over any two string lists, not specifically
 * interests) rather than inventing a second scoring algorithm.
 */
export function computeMusicMatch(tracksA: string[], tracksB: string[]): MusicMatch {
  const setB = new Set(tracksB);
  const sharedTracks = tracksA.filter((track) => setB.has(track));
  return { sharedTracks, compatibility: computeInterestCompatibility(tracksA, tracksB) };
}
