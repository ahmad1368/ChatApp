import { randomUUID } from "crypto";
import QRCode from "qrcode";

export interface EventTicket {
  eventId: string;
  attendee: string;
  host: string;
  token: string;
  issuedAt: string;
  checkedInAt: string | null;
}

export type IssueTicketResult = { success: true; ticket: EventTicket; qrCodeDataUrl: string } | { success: false; error: string };
export type ConfirmCheckInResult = { success: true; ticket: EventTicket } | { success: false; error: string };

/**
 * Match.com's real "Ability to confirm event attendance with a QR code"
 * (#230) — the QR check-in half of the "RSVP/capacity/QR check-in"
 * implementation guide shared with #221/#222/#227/#228 (whose stores
 * cover the RSVP/capacity half and explicitly defer this to here rather
 * than duplicating it). A generic per-(event, attendee) ticket rather
 * than one bolted onto each event store separately, since the check-in
 * mechanic itself — issue a token, render it as a real scannable QR
 * code (reusing #26's `qrcode` package, the same one 2FA setup already
 * uses), let the host scan/confirm it once — doesn't change no matter
 * which store an eventId belongs to. Only the host who issued a ticket
 * can confirm it, and a ticket can only be checked in once.
 */
export class EventCheckInStore {
  private ticketsByKey = new Map<string, EventTicket>();

  private key(eventId: string, attendee: string): string {
    return `${eventId}::${attendee}`;
  }

  async issueTicket(eventId: unknown, host: unknown, attendee: unknown): Promise<IssueTicketResult> {
    const eventIdText = typeof eventId === "string" ? eventId.trim() : "";
    if (!eventIdText) return { success: false, error: "eventId is required" };

    const hostName = typeof host === "string" ? host.trim() : "";
    if (!hostName) return { success: false, error: "host is required" };

    const attendeeName = typeof attendee === "string" ? attendee.trim() : "";
    if (!attendeeName) return { success: false, error: "attendee is required" };

    const key = this.key(eventIdText, attendeeName);
    let ticket = this.ticketsByKey.get(key);
    if (!ticket) {
      ticket = {
        eventId: eventIdText,
        attendee: attendeeName,
        host: hostName,
        token: randomUUID(),
        issuedAt: new Date().toISOString(),
        checkedInAt: null,
      };
      this.ticketsByKey.set(key, ticket);
    }

    const qrCodeDataUrl = await QRCode.toDataURL(ticket.token);
    return { success: true, ticket, qrCodeDataUrl };
  }

  getTicket(eventId: string, attendee: string): EventTicket | undefined {
    return this.ticketsByKey.get(this.key(eventId, attendee));
  }

  /** Every ticket issued for an event, for the host's roster view. */
  listTickets(eventId: string): EventTicket[] {
    return [...this.ticketsByKey.values()]
      .filter((ticket) => ticket.eventId === eventId)
      .sort((a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime());
  }

  confirmCheckIn(scannedBy: unknown, token: unknown): ConfirmCheckInResult {
    const tokenText = typeof token === "string" ? token.trim() : "";
    const ticket = [...this.ticketsByKey.values()].find((t) => t.token === tokenText);
    if (!ticket) return { success: false, error: "Ticket not found" };

    const scannedByName = typeof scannedBy === "string" ? scannedBy.trim() : "";
    if (ticket.host !== scannedByName) return { success: false, error: "Only the event host can check in attendees" };

    if (ticket.checkedInAt) return { success: false, error: "This ticket has already been checked in" };

    ticket.checkedInAt = new Date().toISOString();
    return { success: true, ticket };
  }
}
