// WhatsApp's real "Delete for Everyone" window has been extended well
// past its original ~1 hour over the years; this is on that order —
// longer than #133's 15-minute edit window since deleting a mistakenly
// sent message is a stronger, safety-motivated action people should be
// able to take for longer than a casual text edit.
export const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface DeletableMessage {
  author: string;
  createdAt: string;
}

export type DeleteCheckResult = { allowed: true } | { allowed: false; error: string };

/**
 * WhatsApp/Bumble's real "Delete for Everyone" (#134) — only the original
 * sender, only within a bounded window. Unlike #133's edit (text-only),
 * any message type can be deleted since deletion just replaces the
 * content with a placeholder rather than needing new text to render.
 */
export function canDeleteMessage(message: DeletableMessage, author: string, now: number = Date.now()): DeleteCheckResult {
  if (message.author !== author) {
    return { allowed: false, error: "Only the sender can delete this message" };
  }
  const age = now - new Date(message.createdAt).getTime();
  if (age > DELETE_WINDOW_MS) {
    return { allowed: false, error: "This message is too old to delete for everyone" };
  }
  return { allowed: true };
}
