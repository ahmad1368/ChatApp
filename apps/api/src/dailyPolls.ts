export interface PollOption {
  id: string;
  text: string;
}

export interface PollQuestion {
  id: string;
  question: string;
  options: PollOption[];
}

/**
 * OkCupid's real "Daily polls focused on relationships and personality"
 * (#214) — distinct from #66's ProfilePromptsStore (a permanent,
 * self-selected profile prompt shown on a profile) and #94/#100's
 * compatibility matching (a private, per-pair score): this is a single
 * shared question everyone answers on a given UTC day, with the appeal
 * being the real aggregate "how did everyone else answer" percentage
 * breakdown OkCupid's own questionnaire feature is built around. The
 * catalog cycles deterministically by day-of-epoch so every author sees
 * the same question on the same day without any admin scheduling.
 */
export const POLL_CATALOG: PollQuestion[] = [
  {
    id: "love-language",
    question: "What's your primary love language?",
    options: [
      { id: "words", text: "Words of affirmation" },
      { id: "acts", text: "Acts of service" },
      { id: "gifts", text: "Receiving gifts" },
      { id: "time", text: "Quality time" },
      { id: "touch", text: "Physical touch" },
    ],
  },
  {
    id: "first-date",
    question: "What's your ideal first date?",
    options: [
      { id: "coffee", text: "Coffee or a casual drink" },
      { id: "dinner", text: "A proper dinner" },
      { id: "activity", text: "An activity (hike, museum, class)" },
      { id: "video-call", text: "A video call before meeting up" },
    ],
  },
  {
    id: "conflict-style",
    question: "How do you handle conflict in a relationship?",
    options: [
      { id: "talk-now", text: "Talk it out immediately" },
      { id: "cool-off", text: "Take time to cool off first" },
      { id: "avoid", text: "Avoid confrontation when possible" },
    ],
  },
  {
    id: "weekend-vibe",
    question: "Ideal weekend: going out or staying in?",
    options: [
      { id: "out", text: "Going out" },
      { id: "in", text: "Staying in" },
      { id: "both", text: "A mix of both" },
    ],
  },
  {
    id: "planning-style",
    question: "Are you a planner or a spontaneous person?",
    options: [
      { id: "planner", text: "Planner" },
      { id: "spontaneous", text: "Spontaneous" },
    ],
  },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function getTodaysPoll(): PollQuestion {
  return POLL_CATALOG[dayIndex() % POLL_CATALOG.length];
}

export interface PollResultOption extends PollOption {
  votes: number;
  percentage: number;
}

export interface PollStatus {
  poll: PollQuestion;
  myVote: string | null;
  results: PollResultOption[];
  totalVotes: number;
}

export type VoteResult = { success: true; status: PollStatus } | { success: false; error: string };

export class DailyPollStore {
  private votesByDate = new Map<string, Map<string, string>>();

  private votesForToday(): Map<string, string> {
    const today = todayKey();
    let votes = this.votesByDate.get(today);
    if (!votes) {
      votes = new Map();
      this.votesByDate.set(today, votes);
    }
    return votes;
  }

  private buildStatus(author: string, poll: PollQuestion, votes: Map<string, string>): PollStatus {
    const totalVotes = votes.size;
    const results: PollResultOption[] = poll.options.map((option) => {
      const count = [...votes.values()].filter((v) => v === option.id).length;
      return { ...option, votes: count, percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0 };
    });
    return { poll, myVote: votes.get(author) ?? null, results, totalVotes };
  }

  getStatus(author: unknown): PollStatus {
    const authorText = typeof author === "string" ? author.trim() : "";
    return this.buildStatus(authorText, getTodaysPoll(), this.votesForToday());
  }

  vote(author: unknown, optionId: unknown): VoteResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };

    const poll = getTodaysPoll();
    const option = poll.options.find((o) => o.id === optionId);
    if (!option) return { success: false, error: `optionId must be one of: ${poll.options.map((o) => o.id).join(", ")}` };

    const votes = this.votesForToday();
    if (votes.has(authorText)) return { success: false, error: "You've already voted in today's poll" };

    votes.set(authorText, option.id);
    return { success: true, status: this.buildStatus(authorText, poll, votes) };
  }
}
