// WhatsApp's real 15-minute edit window — a safety/integrity bound so
// chat history can't be silently rewritten long after the fact.
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export interface EditableMessage {
  author: string;
  createdAt: string;
  imageUrl?: string;
  audioUrl?: string;
  selfDestructImageUrl?: string;
  location?: unknown;
}

export type EditCheckResult = { allowed: true } | { allowed: false; error: string };

/**
 * Bumble's real "edit a sent message" (#133) — only the original sender,
 * only within a bounded time window, and only for a plain text message:
 * this app's media message types (#122's voice notes, #123's self-
 * destruct photos, #124's GIFs, #127's location shares) have no caption
 * concept to edit, so their content stays immutable.
 */
export function canEditMessage(message: EditableMessage, author: string, now: number = Date.now()): EditCheckResult {
  if (message.author !== author) {
    return { allowed: false, error: "Only the sender can edit this message" };
  }
  if (message.imageUrl || message.audioUrl || message.selfDestructImageUrl || message.location) {
    return { allowed: false, error: "Only text messages can be edited" };
  }
  const age = now - new Date(message.createdAt).getTime();
  if (age > EDIT_WINDOW_MS) {
    return { allowed: false, error: "This message is too old to edit" };
  }
  return { allowed: true };
}
