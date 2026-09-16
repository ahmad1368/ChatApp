export interface MessageEvent {
  roomId: string;
  author: string;
  createdAt: string;
}

export type ResponseSpeedLabel = "fast" | "moderate" | "slow" | "unknown";

export interface ResponseSpeed {
  medianResponseSeconds: number | null;
  label: ResponseSpeedLabel;
}

const FAST_THRESHOLD_SECONDS = 5 * 60;
const MODERATE_THRESHOLD_SECONDS = 60 * 60;

/**
 * Bumble's real "Fast replier"-style badge, generalized to Tinder's
 * "System showing a user's message response speed" (#254) — a real
 * median measured from this author's own actual reply gaps across every
 * room they've sent a message in, the same cross-room aggregation #236's
 * typingPatternDetector.ts already established, not a fabricated
 * estimate. A "response" is only counted where the immediately preceding
 * message in that room came from someone else — two of the author's own
 * consecutive messages (adding a thought, not replying to anyone) aren't
 * a response gap.
 */
export function computeResponseSpeed(events: MessageEvent[], author: string): ResponseSpeed {
  const byRoom = new Map<string, MessageEvent[]>();
  for (const event of events) {
    const list = byRoom.get(event.roomId) ?? [];
    list.push(event);
    byRoom.set(event.roomId, list);
  }

  const responseSecondsList: number[] = [];
  for (const roomEvents of byRoom.values()) {
    const sorted = [...roomEvents].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      if (previous.author === author || current.author !== author) continue;
      const seconds = (new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime()) / 1000;
      if (seconds >= 0) responseSecondsList.push(seconds);
    }
  }

  if (responseSecondsList.length === 0) {
    return { medianResponseSeconds: null, label: "unknown" };
  }

  responseSecondsList.sort((a, b) => a - b);
  const mid = Math.floor(responseSecondsList.length / 2);
  const median =
    responseSecondsList.length % 2 === 0 ? (responseSecondsList[mid - 1] + responseSecondsList[mid]) / 2 : responseSecondsList[mid];

  const label: ResponseSpeedLabel =
    median <= FAST_THRESHOLD_SECONDS ? "fast" : median <= MODERATE_THRESHOLD_SECONDS ? "moderate" : "slow";

  return { medianResponseSeconds: Math.round(median), label };
}
