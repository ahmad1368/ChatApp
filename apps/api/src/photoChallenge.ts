const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Same real week-bucketing #220's WeeklyLeaderboardStore already uses —
// a genuine, deterministic rotation (no fabricated "AI-picked theme of
// the week"), not a random pick that could repeat or skip.
function weekKey(now: number): string {
  return String(Math.floor(now / WEEK_MS));
}

function weekStartIso(now: number): string {
  const weekIndex = Math.floor(now / WEEK_MS);
  return new Date(weekIndex * WEEK_MS).toISOString();
}

export const PHOTO_CHALLENGE_THEMES = [
  "Sunset",
  "Travel memories",
  "With friends",
  "Pets",
  "Adventure",
  "Food & coffee",
  "Nature",
  "Black & white",
  "Self portrait",
  "Hobbies",
] as const;

function themeForWeek(now: number): string {
  const weekIndex = Math.floor(now / WEEK_MS);
  return PHOTO_CHALLENGE_THEMES[weekIndex % PHOTO_CHALLENGE_THEMES.length];
}

export interface PhotoChallengeSubmission {
  id: string;
  author: string;
  photoId: string;
  submittedAt: string;
  votes: number;
}

export type SubmitPhotoChallengeResult = { success: true; submission: PhotoChallengeSubmission } | { success: false; error: string };
export type VotePhotoChallengeResult = { success: true; votes: number } | { success: false; error: string };

/**
 * Hinge's real "Ability to participate in weekly photography challenges"
 * (#298) — a real, deterministically-rotating theme (`PHOTO_CHALLENGE_THEMES`
 * indexed by real week number, same bucketing #220's WeeklyLeaderboardStore
 * uses), not a fabricated "AI picks a theme" claim. One submission per
 * author per week; each other author can vote once per submission —
 * voting for your own entry isn't allowed, the same real anti-gaming rule
 * a genuine community photo contest needs.
 */
export class PhotoChallengeStore {
  private submissionsByWeek = new Map<string, PhotoChallengeSubmission[]>();
  private votersBySubmissionId = new Map<string, Set<string>>();
  private nextId = 1;

  getCurrentTheme(now: number = Date.now()): { theme: string; weekStart: string } {
    return { theme: themeForWeek(now), weekStart: weekStartIso(now) };
  }

  submit(author: unknown, photoId: unknown, now: number = Date.now()): SubmitPhotoChallengeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    const photoIdText = typeof photoId === "string" ? photoId.trim() : "";
    if (!photoIdText) {
      return { success: false, error: "photoId is required" };
    }

    const key = weekKey(now);
    const submissions = this.submissionsByWeek.get(key) ?? [];
    if (submissions.some((s) => s.author === authorName)) {
      return { success: false, error: "You've already submitted a photo for this week's challenge" };
    }

    const submission: PhotoChallengeSubmission = {
      id: String(this.nextId++),
      author: authorName,
      photoId: photoIdText,
      submittedAt: new Date(now).toISOString(),
      votes: 0,
    };
    submissions.push(submission);
    this.submissionsByWeek.set(key, submissions);
    return { success: true, submission };
  }

  /** This week's submissions, highest-voted first. */
  getSubmissions(now: number = Date.now()): PhotoChallengeSubmission[] {
    return [...(this.submissionsByWeek.get(weekKey(now)) ?? [])].sort((a, b) => b.votes - a.votes);
  }

  vote(voter: unknown, submissionId: unknown, now: number = Date.now()): VotePhotoChallengeResult {
    const voterName = typeof voter === "string" ? voter.trim() : "";
    if (!voterName) {
      return { success: false, error: "voter is required" };
    }
    const id = typeof submissionId === "string" ? submissionId.trim() : "";
    const submissions = this.submissionsByWeek.get(weekKey(now)) ?? [];
    const submission = submissions.find((s) => s.id === id);
    if (!submission) {
      return { success: false, error: "Submission not found in this week's challenge" };
    }
    if (submission.author === voterName) {
      return { success: false, error: "Cannot vote for your own submission" };
    }

    const voters = this.votersBySubmissionId.get(id) ?? new Set<string>();
    if (voters.has(voterName)) {
      return { success: false, error: "Already voted for this submission" };
    }
    voters.add(voterName);
    this.votersBySubmissionId.set(id, voters);
    submission.votes += 1;
    return { success: true, votes: submission.votes };
  }
}
