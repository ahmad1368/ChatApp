"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CATEGORIES: { key: string; label: string; description: string }[] = [
  { key: "newMessage", label: "New messages", description: "Someone sends you a chat message" },
  { key: "newMatch", label: "New matches", description: "You and someone else both liked each other" },
  { key: "newLike", label: "New likes", description: "Someone likes your profile" },
  { key: "matchExpiryReminder", label: "Expiring chat reminders", description: "A match's 24-hour window is about to close" },
  { key: "liveEventStart", label: "Live events", description: "An event you're subscribed to is starting" },
];

/**
 * Tinder's real "Detailed notification category management in settings"
 * (#156) — per-category on/off toggles, keyed to the same guest chat
 * identity push subscriptions already use (see ChatRoom.tsx's
 * enableWebPush), not the separate account-auth identity #26-28's other
 * settings pages use. Only "New messages" is actually enforced today
 * (see notificationPreferences.ts's doc comment) — the other four
 * categories' push send sites live on their own not-yet-merged branches.
 */
export default function NotificationSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/notification-preferences/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setPreferences(body.preferences ?? {}))
      .catch(() => {});
  }, [author]);

  const toggle = (key: string) => {
    const next = !preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: next }));
    setStatus(null);
    fetch(`${API_URL}/api/notification-preferences/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("Saved.");
      })
      .catch(() => setStatus("Failed to save — please try again."));
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Notification settings</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Choose which push notifications you want to receive. All categories are on by default.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {CATEGORIES.map(({ key, label, description }) => (
          <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
            <input type="checkbox" checked={preferences[key] ?? true} onChange={() => toggle(key)} style={{ marginTop: 3 }} />
            <span>
              <strong>{label}</strong>
              <br />
              <span style={{ color: "var(--color-muted)", fontSize: 13 }}>{description}</span>
            </span>
          </label>
        ))}
      </div>

      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
    </main>
  );
}
