// A comment is a stronger positive signal than a like (it took real
// effort), but a like is still the primary vote — an arbitrary, disclosed
// weighting, since neither reference app ever published a real one (same
// scoping call as #220's weeklyLeaderboard.ts activity/popularity weight).
const NOTE_WEIGHT = 0.5;

// Below this much combined engagement across the whole album, there isn't
// enough real signal to suggest anything — an honest "no fabricated
// opinion" floor rather than confidently reordering photos off one like.
const MIN_TOTAL_FEEDBACK = 3;

export interface PhotoFeedbackEntry {
  photoId: string;
  likeCount: number;
  noteCount: number;
}

export interface PhotoFeedbackRanking extends PhotoFeedbackEntry {
  score: number;
}

export interface BestPhotoSuggestion {
  ranked: PhotoFeedbackRanking[];
  suggestedPhotoId: string | null;
  hasEnoughFeedback: boolean;
}

/**
 * Hinge's real "Automatic suggestion of the best photos based on others'
 * feedback" (#232): ranks an album's existing photos by the real
 * engagement signal #112's `PhotoInteractionStore` already tracks (likes
 * and notes from other users), not a fabricated computer-vision "photo
 * quality" model this app has no inference infrastructure for. A
 * suggestion only surfaces once the album has real feedback to act on
 * (MIN_TOTAL_FEEDBACK) and there's more than one photo to actually choose
 * between — otherwise this honestly reports "not enough feedback yet"
 * rather than guessing.
 */
export function suggestBestPhoto(entries: PhotoFeedbackEntry[]): BestPhotoSuggestion {
  const ranked = entries
    .map((entry) => ({ ...entry, score: entry.likeCount + entry.noteCount * NOTE_WEIGHT }))
    .sort((a, b) => b.score - a.score);

  const totalFeedback = entries.reduce((sum, entry) => sum + entry.likeCount + entry.noteCount, 0);
  const hasEnoughFeedback = totalFeedback >= MIN_TOTAL_FEEDBACK;
  const suggestedPhotoId = hasEnoughFeedback && ranked.length > 1 ? ranked[0].photoId : null;

  return { ranked, suggestedPhotoId, hasEnoughFeedback };
}
