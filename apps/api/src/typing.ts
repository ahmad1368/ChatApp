/**
 * Bumble's real typing indicator (#126) — per-room set of currently-typing
 * authors. Starting/stopping is client-driven (the client debounces its
 * own "stopped typing" after a pause in keystrokes, same as every real
 * chat app's typing indicator — there's no reliable server-side signal
 * for "the user stopped typing" otherwise) with `stopTypingEverywhere`
 * as a server-side safety net for an unclean disconnect (dropped
 * connection, closed tab) so a typing indicator never gets stuck on.
 */
export class TypingStore {
  private typingByRoom = new Map<string, Set<string>>();

  startTyping(roomId: string, author: string): void {
    const set = this.typingByRoom.get(roomId) ?? new Set<string>();
    set.add(author);
    this.typingByRoom.set(roomId, set);
  }

  stopTyping(roomId: string, author: string): void {
    this.typingByRoom.get(roomId)?.delete(author);
  }

  /** Clears an author from every room's typing set — called on disconnect. */
  stopTypingEverywhere(author: string): void {
    for (const set of this.typingByRoom.values()) {
      set.delete(author);
    }
  }

  getTypingAuthors(roomId: string): string[] {
    return Array.from(this.typingByRoom.get(roomId) ?? []);
  }
}
