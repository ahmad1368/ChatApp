import { randomBytes } from "crypto";
import { DateStatus, DATE_STATUSES, SharedDate, SharedDateView, TrustedContactInfo } from "@chatapp/shared";

export type CreateSharedDateResult = { success: true; date: SharedDate } | { success: false; error: string };
export type UpdateStatusResult = { success: true; date: SharedDate } | { success: false; error: string };

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

    const contacts: TrustedContactInfo[] = contactNames.map((name) => ({
      name,
      shareCode: randomBytes(4).toString("hex"),
    }));

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
}
