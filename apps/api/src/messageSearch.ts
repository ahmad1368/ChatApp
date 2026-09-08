export interface SearchableMessage {
  id: string;
  text: string;
  deleted?: boolean;
}

/**
 * Bumble's real "Search within conversation text" (#140) — a case-
 * insensitive substring match over each message's plain text. Deleted
 * messages (#134) are excluded since their real content is gone (the
 * stored text is just a placeholder, not something the sender wrote);
 * media-only messages (#122/#123/#124/#127) with an empty text field
 * naturally never match a non-empty query.
 */
export function searchMessages<T extends SearchableMessage>(messages: T[], query: string): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  return messages.filter((message) => !message.deleted && message.text.toLowerCase().includes(trimmed));
}
