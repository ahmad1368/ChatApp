import { ChatMessage } from "@chatapp/shared";

export interface DataExport {
  author: string;
  exportedAt: string;
  messages: ChatMessage[];
}

/**
 * GDPR data portability: a personal-data backup for one author, gathered
 * across every room. Kept as its own dependency-free function (same shape
 * as the account-deletion path) so other data stores can extend the export
 * the same way AccountDeletionCoordinator lets stores register purgers,
 * once this and the deletion branch are both merged.
 */
export function exportDataForAuthor(messagesByRoom: Map<string, ChatMessage[]>, author: string): DataExport {
  const messages: ChatMessage[] = [];
  for (const roomMessages of messagesByRoom.values()) {
    for (const message of roomMessages) {
      if (message.author === author) {
        messages.push(message);
      }
    }
  }
  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { author, exportedAt: new Date().toISOString(), messages };
}
