export const MIN_MESSAGES_BEFORE_VIDEO_CALL = 10;

export interface VideoCallEligibility {
  eligible: boolean;
  messagesExchanged: number;
  required: number;
}

/**
 * Bumble's real "mandatory text-first" gate (#130): a video call between
 * two people can't start until they've exchanged this many messages in
 * that room — an audio call (#128) has no such gate, matching Bumble's
 * own video-specific rule ("get comfortable by voice first" is its own
 * framing, not applied to plain calling). Counts either participant's
 * messages in the room, not requiring both sides to have spoken equally.
 */
export function checkVideoCallEligibility(
  roomMessages: { author: string }[],
  caller: string,
  callee: string
): VideoCallEligibility {
  const messagesExchanged = roomMessages.filter((m) => m.author === caller || m.author === callee).length;
  return {
    eligible: messagesExchanged >= MIN_MESSAGES_BEFORE_VIDEO_CALL,
    messagesExchanged,
    required: MIN_MESSAGES_BEFORE_VIDEO_CALL,
  };
}
