import { ChatMessage } from "@chatapp/shared";

export function deleteMessagesForAuthor(messagesByRoom: Map<string, ChatMessage[]>, author: string): number {
  let deletedCount = 0;
  for (const [roomId, messages] of messagesByRoom) {
    const remaining = messages.filter((m) => {
      if (m.author !== author) return true;
      deletedCount++;
      return false;
    });
    messagesByRoom.set(roomId, remaining);
  }
  return deletedCount;
}

/**
 * GDPR erasure: its own high-priority, dependency-free safety path, same as
 * Report/Block/SOS — deletion doesn't wait on or depend on any heavier
 * service. A registry rather than a single hardcoded purge function so that
 * as other safety-feature data stores land (blocks, safety plans, SOS
 * contacts, WebAuthn credentials, uploaded photos — each currently on its
 * own unmerged branch), each can register its own purge callback here once
 * merged, instead of this coordinator needing to import every store's
 * internals directly.
 */
export class AccountDeletionCoordinator {
  private purgers: Array<(author: string) => number> = [];

  register(purge: (author: string) => number): void {
    this.purgers.push(purge);
  }

  deleteAllDataFor(author: string): { deletedRecordCount: number } {
    const deletedRecordCount = this.purgers.reduce((total, purge) => total + purge(author), 0);
    return { deletedRecordCount };
  }
}
