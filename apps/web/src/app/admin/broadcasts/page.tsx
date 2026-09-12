"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Broadcast {
  id: string;
  title: string;
  body: string;
  sentBy: string;
  sentAt: string;
  recipientCount: number;
}

/**
 * Bumble's real "Send broadcast messages and notifications" (#178). Goes
 * out to every currently push-subscribed, opted-in user (see
 * push.ts/notificationPreferences.ts) — there's no separate email/SMS
 * channel in this app, so that's the honest reach of "everyone."
 */
export default function AdminBroadcastsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [broadcasts, setBroadcasts] = useState<Broadcast[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const loadHistory = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/broadcasts`, { headers: { "x-admin-key": adminKey } });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to load broadcast history");
      return;
    }
    setBroadcasts((await res.json()).broadcasts);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSentMessage(null);
    const res = await fetch(`${API_URL}/api/admin/broadcasts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ title, body, sentBy: "admin" }),
    });
    const responseBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(responseBody.error ?? "Failed to send broadcast");
      return;
    }
    setSentMessage(`Sent to ${responseBody.broadcast.recipientCount} subscribed user(s).`);
    setTitle("");
    setBody("");
    loadHistory();
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Broadcast messages</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadHistory();
        }}
        style={{ display: "flex", gap: 8, marginTop: 16 }}
      >
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Admin key"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={!adminKey}>
          Load history
        </button>
      </form>

      {error && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}
      {sentMessage && <p style={{ marginTop: 12 }}>{sentMessage}</p>}

      <form onSubmit={send} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>New broadcast</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
          rows={3}
          style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
        />
        <button type="submit" disabled={!adminKey || !title || !body} style={{ marginTop: 8 }}>
          Send to all subscribed users
        </button>
      </form>

      {broadcasts && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {broadcasts.map((broadcast) => (
            <li key={broadcast.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0 }}>
                <strong>{broadcast.title}</strong>
              </p>
              <p style={{ margin: "4px 0", fontSize: 13 }}>{broadcast.body}</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-muted)" }}>
                Sent by {broadcast.sentBy} to {broadcast.recipientCount} user(s) on {new Date(broadcast.sentAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
