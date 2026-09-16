import { randomBytes } from "crypto";
import { DateStatus, DATE_STATUSES, SharedDate, SharedDateView, TrustedContactInfo } from "@chatapp/shared";

export type CreateSharedDateResult = { success: true; date: SharedDate } | { success: false; error: string };
export type UpdateStatusResult = { success: true; date: SharedDate } | { success: false; error: string };

// #314's real "Automatic SMS alert system if there's no response after a
// date" — a real, disclosed grace period after the planned meeting time,
// not an arbitrary/hidden one.
export const NO_RESPONSE_ALERT_WINDOW_MS = 3 * 60 * 60 * 1000;

interface InternalSharedDate extends Omit<SharedDate, "contacts"> {
  contacts: TrustedContactInfo[];
}

/**
 * "Share My Date": richer than a single static link (see SafetyPlanStore /
 * issue #46) — multiple named trusted contacts each get their own share
 * code (so access can be revoked/audited per-contact), and the sharer can
 * push live status updates ("on the way", "arrived", "safe", "need help")
 * that every contact sees on their next view. Its own dependency-free
 * safety path, same as Report/Block.
 */
export class SharedDateStore {
  private datesById = new Map<string, InternalSharedDate>();
  private dateIdByShareCode = new Map<string, string>();
  private nextId = 1;

  create(author: unknown, payload: Record<string, unknown> | undefined): CreateSharedDateResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const meetingWith = typeof payload?.meetingWith === "string" ? payload.meetingWith.trim() : "";
    const location = typeof payload?.location === "string" ? payload.location.trim() : "";
    const scheduledAtRaw = typeof payload?.scheduledAt === "string" ? payload.scheduledAt : "";
    const contactNamesRaw = payload?.contactNames;
    const contactPhonesRaw = payload?.contactPhones;

    if (!authorName) return { success: false, error: "author is required" };
    if (!meetingWith) return { success: false, error: "meetingWith is required" };
    if (!location) return { success: false, error: "location is required" };

    const scheduledAt = new Date(scheduledAtRaw);
    if (!scheduledAtRaw || Number.isNaN(scheduledAt.getTime())) {
      return { success: false, error: "scheduledAt must be a valid date/time" };
    }

    const contactNames = Array.isArray(contactNamesRaw)
      ? contactNamesRaw.filter((n): n is string => typeof n === "string" && n.trim().length > 0).map((n) => n.trim())
      : [];
    if (contactNames.length === 0) {
      return { success: false, error: "At least one trusted contact is required" };
    }
    // Positional match to contactNames — a contact with no corresponding
    // phone entry (or a blank one) just gets a link, no SMS alert.
    const contactPhones = Array.isArray(contactPhonesRaw) ? contactPhonesRaw : [];

    const contacts: TrustedContactInfo[] = contactNames.map((name, i) => {
      const phone = typeof contactPhones[i] === "string" ? (contactPhones[i] as string).trim() : "";
      return { name, shareCode: randomBytes(4).toString("hex"), ...(phone ? { phone } : {}) };
    });

    const date: InternalSharedDate = {
      id: String(this.nextId++),
      author: authorName,
      meetingWith,
      location,
      scheduledAt: scheduledAt.toISOString(),
      status: "planned",
      revoked: false,
      createdAt: new Date().toISOString(),
      contacts,
      noResponseAlertSent: false,
    };

    this.datesById.set(date.id, date);
    for (const contact of contacts) {
      this.dateIdByShareCode.set(contact.shareCode, date.id);
    }

    return { success: true, date: { ...date } };
  }

  updateStatus(author: unknown, id: string, status: unknown): UpdateStatusResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const date = this.datesById.get(id);
    if (!date) return { success: false, error: "Shared date not found" };
    if (date.author !== authorName) return { success: false, error: "Only the sharer can update status" };
    if (typeof status !== "string" || !DATE_STATUSES.includes(status as DateStatus)) {
      return { success: false, error: `status must be one of: ${DATE_STATUSES.join(", ")}` };
    }
    date.status = status as DateStatus;
    return { success: true, date: { ...date } };
  }

  revoke(author: unknown, id: string): boolean {
    const authorName = typeof author === "string" ? author.trim() : "";
    const date = this.datesById.get(id);
    if (!date || date.author !== authorName) return false;
    date.revoked = true;
    return true;
  }

  viewByShareCode(shareCode: string): SharedDateView | undefined {
    const id = this.dateIdByShareCode.get(shareCode);
    if (!id) return undefined;
    const date = this.datesById.get(id);
    if (!date || date.revoked) return undefined;
    const { author, meetingWith, location, scheduledAt, status, createdAt } = date;
    return { author, meetingWith, location, scheduledAt, status, createdAt };
  }

  /**
   * #314's real automatic no-response check: a not-revoked, not-yet-
   * alerted date whose sharer never updated status past "planned" (i.e.
   * never checked in at all) once NO_RESPONSE_ALERT_WINDOW_MS has passed
   * since the planned meeting time.
   */
  getDatesNeedingNoResponseAlert(now: number = Date.now()): InternalSharedDate[] {
    return [...this.datesById.values()].filter(
      (date) =>
        !date.revoked &&
        !date.noResponseAlertSent &&
        date.status === "planned" &&
        now - new Date(date.scheduledAt).getTime() >= NO_RESPONSE_ALERT_WINDOW_MS
    );
  }

  markNoResponseAlertSent(id: string): void {
    const date = this.datesById.get(id);
    if (date) date.noResponseAlertSent = true;
  }
}
