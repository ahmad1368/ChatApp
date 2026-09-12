import { randomUUID } from "crypto";

const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 500;

export interface BroadcastRecord {
  id: string;
  title: string;
  body: string;
  sentBy: string;
  sentAt: string;
  recipientCount: number;
}

export type SendBroadcastResult = { success: true; broadcast: BroadcastRecord } | { success: false; error: string };

/**
 * Bumble's real "Send broadcast messages and notifications" (#178) — an
 * admin composes a one-off announcement that goes out to every currently
 * push-subscribed user (see server.ts's route, which drives
 * PushService.broadcast() and records one NotificationInboxStore entry
 * per recipient) and records to who and when. This store is the audit
 * trail half: it doesn't send anything itself, so it stays trivially
 * testable independent of web-push.
 */
export class BroadcastStore {
  private broadcasts: BroadcastRecord[] = [];

  record(title: unknown, body: unknown, sentBy: unknown, recipientCount: number): SendBroadcastResult {
    const titleText = typeof title === "string" ? title.trim() : "";
    const bodyText = typeof body === "string" ? body.trim() : "";
    const sentByName = typeof sentBy === "string" ? sentBy.trim() : "";
    if (!titleText) return { success: false, error: "title is required" };
    if (titleText.length > MAX_TITLE_LENGTH) return { success: false, error: `title must be ${MAX_TITLE_LENGTH} characters or fewer` };
    if (!bodyText) return { success: false, error: "body is required" };
    if (bodyText.length > MAX_BODY_LENGTH) return { success: false, error: `body must be ${MAX_BODY_LENGTH} characters or fewer` };
    if (!sentByName) return { success: false, error: "sentBy is required" };

    const broadcast: BroadcastRecord = {
      id: randomUUID(),
      title: titleText,
      body: bodyText,
      sentBy: sentByName,
      sentAt: new Date().toISOString(),
      recipientCount,
    };
    this.broadcasts.unshift(broadcast);
    return { success: true, broadcast };
  }

  /** Every broadcast ever sent, most recent first — the admin audit history. */
  list(): BroadcastRecord[] {
    return [...this.broadcasts];
  }
}
