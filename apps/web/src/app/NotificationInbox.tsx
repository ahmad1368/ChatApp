"use client";

import { useEffect, useRef, useState } from "react";
import { playRingtone, vibrateForeground, vibrationPatternForCategory, RingtoneId } from "./notificationSound";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface InboxEntry {
  id: string;
  category: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

/**
 * Tinder's real in-app Notifications tab (#159): a durable, per-author
 * record of new-match/new-like/match-expiry-reminder/live-event-start
 * events (see notificationInbox.ts), shown regardless of whether this
 * browser ever granted push permission or has a live subscription.
 * Opening the panel marks everything read, the same "viewing it is what
 * clears the badge" behavior real Tinder's bell icon has.
 *
 * #160's foreground ringtone/vibration: polling (not a push event) is
 * what notices a newly-arrived entry here, so this works the same
 * whether or not the browser ever granted push permission — see
 * notificationSound.ts (web) for the real synthesized tone and
 * apps/api/src/notificationSound.ts for why background push can only
 * ever carry a vibration pattern, never a custom sound.
 */
export default function NotificationInbox({ author }: { author: string }) {
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ringtoneRef = useRef<RingtoneId>("default");
  const vibrationEnabledRef = useRef(true);
  const lastSeenIdRef = useRef<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    fetch(`${API_URL}/api/notification-sound/${encodeURIComponent(author)}`)
      .then((res) => (res.ok ? res.json() : undefined))
      .then((body) => {
        if (!body?.preference) return;
        ringtoneRef.current = body.preference.ringtone;
        vibrationEnabledRef.current = body.preference.vibrationEnabled;
      })
      .catch(() => undefined);
  }, [author]);

  const refresh = () => {
    fetch(`${API_URL}/api/notification-inbox/${encodeURIComponent(author)}`)
      .then((res) => (res.ok ? res.json() : undefined))
      .then((body) => {
        if (!body) return;
        const nextEntries: InboxEntry[] = body.entries ?? [];
        const newestId = nextEntries[0]?.id ?? null;
        if (hasLoadedOnceRef.current && newestId && newestId !== lastSeenIdRef.current) {
          playRingtone(ringtoneRef.current);
          if (vibrationEnabledRef.current) {
            vibrateForeground(vibrationPatternForCategory(nextEntries[0].category));
          }
        }
        lastSeenIdRef.current = newestId;
        hasLoadedOnceRef.current = true;
        setEntries(nextEntries);
        setUnreadCount(body.unreadCount ?? 0);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    const intervalId = setInterval(refresh, 30_000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      fetch(`${API_URL}/api/notification-inbox/${encodeURIComponent(author)}/read-all`, { method: "POST" })
        .then(() => {
          setUnreadCount(0);
          setEntries((prev) => prev.map((e) => ({ ...e, read: true })));
        })
        .catch(() => undefined);
    }
  };

  return (
    <div className="chat-app__notification-inbox">
      <button
        className="chat-app__theme-toggle chat-app__notification-inbox-bell"
        onClick={toggleOpen}
        title="Notifications"
      >
        🔔{unreadCount > 0 && <span className="chat-app__notification-inbox-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="chat-app__notification-inbox-panel">
          {entries.length === 0 ? (
            <p className="chat-app__notification-inbox-empty">No notifications yet.</p>
          ) : (
            <ul className="chat-app__notification-inbox-list">
              {entries.map((entry) => (
                <li key={entry.id} className="chat-app__notification-inbox-entry">
                  <strong>{entry.title}</strong>
                  <p>{entry.body}</p>
                  <span className="chat-app__notification-inbox-time">{new Date(entry.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
