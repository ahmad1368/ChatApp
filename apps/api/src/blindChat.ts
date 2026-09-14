export const BLIND_CHAT_DURATION_MINUTES = 10;

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

interface BlindChatSession {
  participants: [string, string];
  startedAt: number;
  revealRequestedBy: Set<string>;
}

export interface BlindChatStatus {
  photosRevealed: boolean;
  revealAt: string;
  secondsRemaining: number;
  revealRequestedByMe: boolean;
  bothRequestedReveal: boolean;
}

export type StartResult = { success: true; status: BlindChatStatus } | { success: false; error: string };
export type RequestRevealResult = { success: true; status: BlindChatStatus } | { success: false; error: string };
export type GetStatusResult = { success: true; status: BlindChatStatus } | { success: false; error: string };

/**
 * Hinge's real "Blind Chat without seeing photos for the first few
 * minutes" (#217) — a real per-pair timer (photos.ts/photoAlbums.ts
 * still hold the actual images; this only decides *whether* the client
 * is allowed to render them yet, the same "server computes a boolean,
 * client applies the blur" split #144's photoWarning.ts already uses).
 * Either side can also request an early reveal; it only takes effect
 * once *both* have asked, the same mutual-consent shape #215's couple
 * quiz and #216's speed-dating interest already use — one side wanting
 * to skip ahead can't unilaterally force the other to be seen sooner.
 */
export class BlindChatStore {
  private sessions = new Map<string, BlindChatSession>();

  private buildStatus(session: BlindChatSession, viewer: string, now: number): BlindChatStatus {
    const revealAtMs = session.startedAt + BLIND_CHAT_DURATION_MINUTES * 60_000;
    const bothRequestedReveal = session.participants.every((p) => session.revealRequestedBy.has(p));
    const photosRevealed = now >= revealAtMs || bothRequestedReveal;
    return {
      photosRevealed,
      revealAt: new Date(revealAtMs).toISOString(),
      secondsRemaining: Math.max(0, Math.round((revealAtMs - now) / 1000)),
      revealRequestedByMe: session.revealRequestedBy.has(viewer),
      bothRequestedReveal,
    };
  }

  start(author: unknown, partner: unknown, now: number = Date.now()): StartResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    const partnerText = typeof partner === "string" ? partner.trim() : "";
    if (!authorText || !partnerText) return { success: false, error: "author and partner are required" };
    if (authorText === partnerText) return { success: false, error: "author and partner must be different people" };

    const key = pairKey(authorText, partnerText);
    let session = this.sessions.get(key);
    if (!session) {
      session = { participants: [authorText, partnerText], startedAt: now, revealRequestedBy: new Set() };
      this.sessions.set(key, session);
    }
    return { success: true, status: this.buildStatus(session, authorText, now) };
  }

  requestReveal(author: unknown, partner: unknown, now: number = Date.now()): RequestRevealResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    const partnerText = typeof partner === "string" ? partner.trim() : "";
    const session = this.sessions.get(pairKey(authorText, partnerText));
    if (!session) return { success: false, error: "Blind chat hasn't started for this pair" };

    session.revealRequestedBy.add(authorText);
    return { success: true, status: this.buildStatus(session, authorText, now) };
  }

  getStatus(author: unknown, partner: unknown, now: number = Date.now()): GetStatusResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    const partnerText = typeof partner === "string" ? partner.trim() : "";
    const session = this.sessions.get(pairKey(authorText, partnerText));
    if (!session) return { success: false, error: "Blind chat hasn't started for this pair" };
    return { success: true, status: this.buildStatus(session, authorText, now) };
  }
}
