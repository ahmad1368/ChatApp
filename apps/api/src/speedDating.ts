const BYE = "__bye__";

/** Every Wednesday at 19:00 UTC — the "set times of the week" the issue asks for. */
export const SPEED_DATING_WEEKDAY_UTC = 3;
export const SPEED_DATING_HOUR_UTC = 19;
export const ROUND_DURATION_MINUTES = 3;

function nextSessionDate(now: Date): Date {
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), SPEED_DATING_HOUR_UTC, 0, 0, 0));
  let daysUntil = (SPEED_DATING_WEEKDAY_UTC - now.getUTCDay() + 7) % 7;
  if (daysUntil === 0 && now.getTime() >= candidate.getTime()) daysUntil = 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysUntil);
  return candidate;
}

/**
 * The real "circle method" round-robin scheduling algorithm: fixes one
 * player and rotates the rest each round, so across N-1 (or N, if odd,
 * with one bye per round) rounds every participant is paired with every
 * other participant exactly once — the actual structure a real speed
 * dating night runs on, not a mock-up.
 */
export function generateRoundRobinRounds(participants: string[]): Array<Array<[string, string]>> {
  if (participants.length < 2) return [];
  const players = [...participants];
  if (players.length % 2 !== 0) players.push(BYE);
  const n = players.length;

  const fixed = players[0];
  let rotating = players.slice(1);
  const rounds: Array<Array<[string, string]>> = [];

  for (let round = 0; round < n - 1; round++) {
    const roundPlayers = [fixed, ...rotating];
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = roundPlayers[i];
      const b = roundPlayers[n - 1 - i];
      if (a !== BYE && b !== BYE) pairs.push([a, b]);
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }
  return rounds;
}

export interface SpeedDatingRound {
  round: number;
  pairs: Array<[string, string]>;
}

interface SpeedDatingSession {
  sessionKey: string;
  startsAt: string;
  participants: string[];
  rounds: SpeedDatingRound[];
  interestByAuthor: Map<string, Set<string>>;
}

export interface NextSession {
  sessionKey: string;
  startsAt: string;
  participants: string[];
}

export type JoinResult = { success: true; session: NextSession } | { success: false; error: string };
export type GenerateRoundsResult = { success: true; rounds: SpeedDatingRound[] } | { success: false; error: string };
export type ExpressInterestResult = { success: true; matched: boolean } | { success: false; error: string };

/**
 * Match.com's real "Speed Dating event at set times of the week" (#216)
 * — distinct from #155's generic LiveEventStore (which only lets any
 * author schedule a one-off event and notifies subscribers when it
 * starts): this is a fixed recurring weekly slot with a real round-robin
 * pairing structure, so joining actually produces a sequence of timed
 * 1-on-1 rounds rather than just an open room. Interest is only
 * expressible about someone you were actually paired with in a round,
 * and — like #94's swipe matching — only becomes visible to both sides
 * once it's mutual.
 */
export class SpeedDatingStore {
  private sessions = new Map<string, SpeedDatingSession>();

  private getOrCreateSession(sessionKey: string, startsAt: string): SpeedDatingSession {
    let session = this.sessions.get(sessionKey);
    if (!session) {
      session = { sessionKey, startsAt, participants: [], rounds: [], interestByAuthor: new Map() };
      this.sessions.set(sessionKey, session);
    }
    return session;
  }

  getNextSession(now: number = Date.now()): NextSession {
    const date = nextSessionDate(new Date(now));
    const sessionKey = date.toISOString();
    const session = this.getOrCreateSession(sessionKey, sessionKey);
    return { sessionKey: session.sessionKey, startsAt: session.startsAt, participants: session.participants };
  }

  join(author: unknown, now: number = Date.now()): JoinResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };

    const next = this.getNextSession(now);
    const session = this.sessions.get(next.sessionKey)!;
    if (!session.participants.includes(authorText)) session.participants.push(authorText);
    return { success: true, session: { sessionKey: session.sessionKey, startsAt: session.startsAt, participants: session.participants } };
  }

  generateRounds(sessionKey: unknown): GenerateRoundsResult {
    const session = this.sessions.get(typeof sessionKey === "string" ? sessionKey : "");
    if (!session) return { success: false, error: "Session not found" };
    if (session.rounds.length > 0) return { success: true, rounds: session.rounds };
    if (session.participants.length < 2) return { success: false, error: "Need at least 2 participants to generate rounds" };

    session.rounds = generateRoundRobinRounds(session.participants).map((pairs, i) => ({ round: i + 1, pairs }));
    return { success: true, rounds: session.rounds };
  }

  expressInterest(sessionKey: unknown, author: unknown, partner: unknown): ExpressInterestResult {
    const session = this.sessions.get(typeof sessionKey === "string" ? sessionKey : "");
    if (!session) return { success: false, error: "Session not found" };

    const authorText = typeof author === "string" ? author.trim() : "";
    const partnerText = typeof partner === "string" ? partner.trim() : "";
    if (!authorText || !partnerText) return { success: false, error: "author and partner are required" };

    const wasPaired = session.rounds.some((round) =>
      round.pairs.some(([a, b]) => (a === authorText && b === partnerText) || (a === partnerText && b === authorText))
    );
    if (!wasPaired) return { success: false, error: "You weren't paired with this person in a round" };

    let interest = session.interestByAuthor.get(authorText);
    if (!interest) {
      interest = new Set();
      session.interestByAuthor.set(authorText, interest);
    }
    interest.add(partnerText);

    const matched = session.interestByAuthor.get(partnerText)?.has(authorText) ?? false;
    return { success: true, matched };
  }

  getMatches(sessionKey: unknown, author: unknown): string[] {
    const session = this.sessions.get(typeof sessionKey === "string" ? sessionKey : "");
    if (!session) return [];
    const authorText = typeof author === "string" ? author.trim() : "";
    const myInterest = session.interestByAuthor.get(authorText);
    if (!myInterest) return [];
    return [...myInterest].filter((partner) => session.interestByAuthor.get(partner)?.has(authorText));
  }
}
