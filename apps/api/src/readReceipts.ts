export const MESSAGE_STATUSES = ["sent", "delivered", "read"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/**
 * Bumble's real sent/delivered/read message status (#125) — tracked as a
 * simple aggregate per message rather than per-recipient detail (WhatsApp's
 * own group-chat "read by" list is its own separate UI Bumble doesn't
 * have either): a message is "read" once *any* other participant has read
 * it, "delivered" once any other participant's client has received it,
 * and "sent" otherwise (accepted by the server, no confirmation yet).
 * "Read" implies "delivered" — you can't read a message a client never
 * received.
 */
export class ReadReceiptStore {
  private deliveredBy = new Map<string, Set<string>>();
  private readBy = new Map<string, Set<string>>();

  markDelivered(messageId: string, author: string): void {
    const set = this.deliveredBy.get(messageId) ?? new Set<string>();
    set.add(author);
    this.deliveredBy.set(messageId, set);
  }

  markRead(messageId: string, author: string): void {
    this.markDelivered(messageId, author);
    const set = this.readBy.get(messageId) ?? new Set<string>();
    set.add(author);
    this.readBy.set(messageId, set);
  }

  /** Status from the sender's point of view — other participants' activity only counts. */
  getStatus(messageId: string, sender: string): MessageStatus {
    const readers = this.readBy.get(messageId);
    if (readers && [...readers].some((author) => author !== sender)) return "read";
    const deliveries = this.deliveredBy.get(messageId);
    if (deliveries && [...deliveries].some((author) => author !== sender)) return "delivered";
    return "sent";
  }
}
