export interface ChallengeDefinition {
  id: string;
  description: string;
  target: number;
  coinReward: number;
}

/**
 * Coffee Meets Bagel's real "Daily challenges (e.g., complete 3 prompt
 * answers or send 2 voice notes)" (#219) — a fixed daily checklist,
 * reset at UTC midnight, whose progress is driven entirely by real
 * events already happening elsewhere in the app (a swipe, a chat
 * message, a voice note, a saved set of profile-prompt answers) rather
 * than a self-reported counter. Completing a challenge doesn't
 * auto-credit coins — claimReward() requires an explicit claim, so a
 * client can show a "claim" button/animation rather than coins silently
 * appearing — but claiming is itself idempotent per challenge per day.
 */
export const DAILY_CHALLENGES: ChallengeDefinition[] = [
  { id: "swipes", description: "Swipe on 10 profiles", target: 10, coinReward: 10 },
  { id: "messages", description: "Send 5 messages", target: 5, coinReward: 10 },
  { id: "voice-notes", description: "Send 2 voice notes", target: 2, coinReward: 15 },
  { id: "prompt-answers", description: "Answer 3 profile prompts", target: 3, coinReward: 15 },
];

const CHALLENGES_BY_ID = new Map(DAILY_CHALLENGES.map((c) => [c.id, c]));

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ChallengeProgress {
  progress: number;
  completed: boolean;
  rewardClaimed: boolean;
}

export interface ChallengeStatus extends ChallengeDefinition, ChallengeProgress {}

export type ClaimRewardResult = { success: true; coinReward: number } | { success: false; error: string };

export class DailyChallengeStore {
  private progressByAuthorDay = new Map<string, Map<string, ChallengeProgress>>();

  private getDayMap(author: string): Map<string, ChallengeProgress> {
    const key = `${author}:${todayKey()}`;
    let dayMap = this.progressByAuthorDay.get(key);
    if (!dayMap) {
      dayMap = new Map();
      this.progressByAuthorDay.set(key, dayMap);
    }
    return dayMap;
  }

  private emptyProgress(): ChallengeProgress {
    return { progress: 0, completed: false, rewardClaimed: false };
  }

  /** Adds to a running count (a swipe, a message, a voice note) — never re-opens an already-completed challenge. */
  incrementProgress(author: unknown, challengeId: string, amount: number = 1): void {
    const authorText = typeof author === "string" ? author.trim() : "";
    const definition = CHALLENGES_BY_ID.get(challengeId);
    if (!authorText || !definition) return;

    const dayMap = this.getDayMap(authorText);
    const entry = dayMap.get(challengeId) ?? this.emptyProgress();
    if (entry.completed) return;
    entry.progress = Math.min(definition.target, entry.progress + amount);
    entry.completed = entry.progress >= definition.target;
    dayMap.set(challengeId, entry);
  }

  /** Sets progress to an absolute level (e.g. "how many prompts are answered right now") rather than accumulating. */
  setProgress(author: unknown, challengeId: string, value: number): void {
    const authorText = typeof author === "string" ? author.trim() : "";
    const definition = CHALLENGES_BY_ID.get(challengeId);
    if (!authorText || !definition) return;

    const dayMap = this.getDayMap(authorText);
    const entry = dayMap.get(challengeId) ?? this.emptyProgress();
    entry.progress = Math.min(definition.target, Math.max(entry.progress, value));
    entry.completed = entry.progress >= definition.target;
    dayMap.set(challengeId, entry);
  }

  getStatus(author: unknown): ChallengeStatus[] {
    const authorText = typeof author === "string" ? author.trim() : "";
    const dayMap = authorText ? this.getDayMap(authorText) : new Map<string, ChallengeProgress>();
    return DAILY_CHALLENGES.map((definition) => ({ ...definition, ...(dayMap.get(definition.id) ?? this.emptyProgress()) }));
  }

  claimReward(author: unknown, challengeId: unknown): ClaimRewardResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    const definition = CHALLENGES_BY_ID.get(typeof challengeId === "string" ? challengeId : "");
    if (!definition) return { success: false, error: "Unknown challenge id" };

    const dayMap = this.getDayMap(authorText);
    const entry = dayMap.get(definition.id);
    if (!entry?.completed) return { success: false, error: "This challenge isn't completed yet" };
    if (entry.rewardClaimed) return { success: false, error: "Reward already claimed" };

    entry.rewardClaimed = true;
    return { success: true, coinReward: definition.coinReward };
  }
}
