import { randomUUID } from "crypto";

export const TICKET_STATUSES = ["open", "inProgress", "resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

const MAX_SUBJECT_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;

export interface TicketMessage {
  id: string;
  sender: "user" | "admin";
  senderName: string;
  text: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  author: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export type CreateTicketResult = { success: true; ticket: SupportTicket } | { success: false; error: string };
export type ReplyResult = { success: true; ticket: SupportTicket } | { success: false; error: string };
export type UpdateStatusResult = { success: true; ticket: SupportTicket } | { success: false; error: string };

function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

function buildMessage(sender: "user" | "admin", senderName: string, text: string): TicketMessage {
  return { id: randomUUID(), sender, senderName, text, createdAt: new Date().toISOString() };
}

/**
 * Bumble's real "Live admin support for users via ticket or chat" (#180)
 * — an asynchronous support ticket thread rather than a live-staffed
 * chat: this app has no real support team behind it, so promising
 * "live" would be a fabricated SLA. A ticket is a real, persisted
 * back-and-forth thread (see reply()) an admin actually works through
 * the same admin-key-gated surface as #171-179, which is the honest
 * version of "admin support" this environment can back with real
 * behavior — the same "reuse a real mechanism, don't fake the rest"
 * scoping as #172-179.
 */
export class SupportTicketStore {
  private ticketsById = new Map<string, SupportTicket>();

  create(author: unknown, subject: unknown, message: unknown): CreateTicketResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const subjectText = typeof subject === "string" ? subject.trim() : "";
    const messageText = typeof message === "string" ? message.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };
    if (!subjectText) return { success: false, error: "subject is required" };
    if (subjectText.length > MAX_SUBJECT_LENGTH) return { success: false, error: `subject must be ${MAX_SUBJECT_LENGTH} characters or fewer` };
    if (!messageText) return { success: false, error: "message is required" };
    if (messageText.length > MAX_MESSAGE_LENGTH) return { success: false, error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` };

    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: randomUUID(),
      author: authorName,
      subject: subjectText,
      status: "open",
      createdAt: now,
      updatedAt: now,
      messages: [buildMessage("user", authorName, messageText)],
    };
    this.ticketsById.set(ticket.id, ticket);
    return { success: true, ticket };
  }

  get(ticketId: string): SupportTicket | undefined {
    return this.ticketsById.get(ticketId);
  }

  // Re-inserting a touched ticket moves it to the end of Map iteration
  // order — reversing that order then gives "most recently updated
  // first" exactly, even when two updates land in the same millisecond
  // (updatedAt alone wouldn't disambiguate that).
  private touch(ticket: SupportTicket): void {
    this.ticketsById.delete(ticket.id);
    this.ticketsById.set(ticket.id, ticket);
  }

  /** A user's own tickets, most recently updated first. */
  listForAuthor(author: string): SupportTicket[] {
    return [...this.ticketsById.values()].filter((t) => t.author === author).reverse();
  }

  /** The full admin queue, open/in-progress tickets first, then resolved — most recently updated within each group first. */
  getAdminQueue(): SupportTicket[] {
    const rank = (status: TicketStatus) => (status === "resolved" ? 1 : 0);
    return [...this.ticketsById.values()]
      .reverse()
      .sort((a, b) => rank(a.status) - rank(b.status));
  }

  /**
   * An admin reply reopens the thread into "inProgress" if it was still
   * "open" — the real signal that someone is now working the ticket. A
   * reply on an already-resolved ticket leaves the status alone; the
   * admin can explicitly reopen it via updateStatus() if that's meant.
   */
  reply(ticketId: string, sender: unknown, senderName: unknown, text: unknown): ReplyResult {
    const ticket = this.ticketsById.get(ticketId);
    if (!ticket) return { success: false, error: "Ticket not found" };
    if (sender !== "user" && sender !== "admin") return { success: false, error: "sender must be 'user' or 'admin'" };
    const senderNameText = typeof senderName === "string" ? senderName.trim() : "";
    if (!senderNameText) return { success: false, error: "senderName is required" };
    const messageText = typeof text === "string" ? text.trim() : "";
    if (!messageText) return { success: false, error: "text is required" };
    if (messageText.length > MAX_MESSAGE_LENGTH) return { success: false, error: `text must be ${MAX_MESSAGE_LENGTH} characters or fewer` };

    ticket.messages.push(buildMessage(sender, senderNameText, messageText));
    ticket.updatedAt = new Date().toISOString();
    if (sender === "admin" && ticket.status === "open") {
      ticket.status = "inProgress";
    }
    this.touch(ticket);
    return { success: true, ticket };
  }

  updateStatus(ticketId: string, status: unknown): UpdateStatusResult {
    const ticket = this.ticketsById.get(ticketId);
    if (!ticket) return { success: false, error: "Ticket not found" };
    if (!isTicketStatus(status)) return { success: false, error: `status must be one of: ${TICKET_STATUSES.join(", ")}` };
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    this.touch(ticket);
    return { success: true, ticket };
  }
}
