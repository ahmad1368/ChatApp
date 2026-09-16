import { computeInterestCompatibility } from "./interestCompatibility";

export interface ArtistMatch {
  sharedArtists: string[];
  compatibility: number;
}

/**
 * Hinge's real "Show a list of shared favorite artists" (#326), same
 * shape as #118's musicMatch.ts applied to #77's Spotify top artists
 * instead of top tracks — surfaces WHICH artists two people have in
 * common rather than a bare score, reusing #94's generic percentage-
 * overlap formula rather than inventing a second scoring algorithm.
 */
export function computeArtistMatch(artistsA: string[], artistsB: string[]): ArtistMatch {
  const setB = new Set(artistsB);
  const sharedArtists = artistsA.filter((artist) => setB.has(artist));
  return { sharedArtists, compatibility: computeInterestCompatibility(artistsA, artistsB) };
}
