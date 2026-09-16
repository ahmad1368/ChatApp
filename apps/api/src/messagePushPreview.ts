const PREVIEW_LENGTH = 80;

/**
 * Tinder's real "Short preview of the first received message on the lock
 * screen" (#265) — extends #5's Web Push (`pushService.notifyOthers`),
 * which currently sends the *full*, untruncated message text as the push
 * body for every single message. This scopes rich content preview to
 * exactly what the issue asks: a short, cleanly truncated preview only
 * for the very first message a recipient gets from a given sender in a
 * room — a real, deliberate privacy choice once a conversation is
 * already underway, subsequent messages fall back to a generic,
 * content-free notification rather than continuing to expose chat
 * content on the lock screen.
 */
export function buildMessagePushPreview(text: string, isFirstMessageFromSender: boolean): string {
  if (!isFirstMessageFromSender) {
    return "New message";
  }
  if (text.length <= PREVIEW_LENGTH) {
    return text;
  }
  return `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
}
