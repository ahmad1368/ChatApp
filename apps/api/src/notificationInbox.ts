import { NotificationCategory } from "./notificationPreferences";

export interface NotificationInboxEntry {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

const MAX_ENTRIES_PER_AUTHOR = 200;

/**
 * Tinder's real in-app Notifications tab (#159): every push-worthy event
 * this app already sends — #151's new match, #153's new like, #154's
 * match-expiry reminder, #155's live-event start — also lands here,
 * independent of whether the browser has push permission granted or a
 * subscription on file. A push notification can be missed, dismissed, or
 * never granted in the first place; this durable per-author list is what
 * a real "Notifications" tab shows regardless. #5's plain "new message"
 * push isn't mirrored here — that event is already visible in the chat
 * list itself, so a duplicate inbox entry would just be noise, and #156's
 * per-category opt-out only governs whether the push itself fires, not
 * whether the in-app record of the event exists.
 */
export class NotificationInboxStore {
  private entriesByAuthor = new Map<string, NotificationInboxEntry[]>();
  private nextId = 1;

  record(author: string, category: NotificationCategory, title: string, body: string): void {
    const entry: NotificationInboxEntry = {
      id: String(this.nextId++),
      category,
      title,
      body,
      createdAt: new Date().toISOString(),
      read: false,
    };
    const entries = this.entriesByAuthor.get(author) ?? [];
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES_PER_AUTHOR) entries.length = MAX_ENTRIES_PER_AUTHOR;
    this.entriesByAuthor.set(author, entries);
  }

  getInbox(author: string): NotificationInboxEntry[] {
    return this.entriesByAuthor.get(author) ?? [];
  }

  getUnreadCount(author: string): number {
    return this.getInbox(author).filter((entry) => !entry.read).length;
  }

  markRead(author: string, id: string): boolean {
    const entry = this.entriesByAuthor.get(author)?.find((e) => e.id === id);
    if (!entry) return false;
    entry.read = true;
    return true;
  }

  markAllRead(author: string): void {
    for (const entry of this.entriesByAuthor.get(author) ?? []) {
      entry.read = true;
    }
  }
}
