export interface MoodProfile {
  valence: number | null;
  energy: number | null;
}

export interface MoodCompatibility {
  compatibility: number;
  moodLabel: string;
}

const MAX_DISTANCE = Math.SQRT2; // Max Euclidean distance between two points in the [0,1]x[0,1] valence/energy square.

/**
 * Hinge's real "System to analyze mood compatibility based on music"
 * (#293) — a real signal, not a fabricated sentiment model: Spotify's own
 * Audio Features API returns "valence" (musical positiveness, 0=sad,
 * 1=happy) and "energy" (0=calm, 1=intense) for every track, the actual
 * quantified mood metrics real music-mood research/apps use. Distinct
 * from #118's `computeMusicMatch` (which compares WHICH tracks two
 * profiles share) — this compares the overall VIBE of each profile's top
 * tracks even when they share no track at all, using average valence/
 * energy as a 2D "mood point" and converting Euclidean distance between
 * the two points into a 0-100% compatibility score.
 */
export function describeMood(valence: number, energy: number): string {
  if (valence >= 0.5 && energy >= 0.5) return "upbeat & energetic";
  if (valence >= 0.5 && energy < 0.5) return "cheerful & mellow";
  if (valence < 0.5 && energy >= 0.5) return "intense & moody";
  return "calm & melancholic";
}

export function computeMoodCompatibility(a: MoodProfile, b: MoodProfile): MoodCompatibility {
  if (a.valence === null || a.energy === null || b.valence === null || b.energy === null) {
    return { compatibility: 0, moodLabel: "unknown" };
  }
  const distance = Math.sqrt((a.valence - b.valence) ** 2 + (a.energy - b.energy) ** 2);
  const compatibility = Math.round((1 - distance / MAX_DISTANCE) * 100);
  return { compatibility, moodLabel: describeMood(a.valence, a.energy) };
}

/** Averages a list of per-track (valence, energy) pairs into one mood point — null if the list is empty. */
export function averageMood(tracks: { valence: number; energy: number }[]): MoodProfile {
  if (tracks.length === 0) return { valence: null, energy: null };
  const valence = tracks.reduce((sum, t) => sum + t.valence, 0) / tracks.length;
  const energy = tracks.reduce((sum, t) => sum + t.energy, 0) / tracks.length;
  return { valence, energy };
}
