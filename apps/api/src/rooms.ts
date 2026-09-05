import { ChatMessage } from "@chatapp/shared";

export class MessageStore {
  private messagesByRoom = new Map<string, ChatMessage[]>();

  add(roomId: string, message: ChatMessage): void {
    const existing = this.messagesByRoom.get(roomId) ?? [];
    existing.push(message);
    this.messagesByRoom.set(roomId, existing);
  }

  /**
   * Returns messages for a room, optionally only those created after `since`
   * (an ISO timestamp). Used both for initial history load and for
   * reconnect/catch-up sync so a client that dropped its socket connection
   * can fetch exactly what it missed instead of the full history.
   */
  list(roomId: string, since?: string): ChatMessage[] {
    const all = this.messagesByRoom.get(roomId) ?? [];
    if (!since) return all;
    return all.filter((m) => m.createdAt > since);
  }
}
