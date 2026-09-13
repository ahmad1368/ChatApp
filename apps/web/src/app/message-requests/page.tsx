"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";
import { DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface DirectMessageRequest {
  id: string;
  from: string;
  text: string;
  sentAt: string;
}

/**
 * Tinder's real "Pay to open a direct chat without needing a Match"
 * (#208) — the recipient side: a real inbox of paid requests from
 * people you haven't matched with, modeled on Tinder's own "Message
 * Before Match" UX. Accepting doesn't create a formal SwipeStore match
 * (this app's chat has no match-gating to open in the first place —
 * see directMessageRequests.ts) — it just lets the conversation
 * continue in the shared room, the same "Chat" flow a real match uses.
 */
export default function MessageRequestsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [requests, setRequests] = useState<DirectMessageRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_URL}/api/direct-message-requests/${encodeURIComponent(author)}/inbox`)
      .then((res) => res.json())
      .then((body) => setRequests(body.requests ?? []))
      .catch(() => {});
  };

  useEffect(load, [author]);

  const respond = async (requestId: string, accept: boolean) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/direct-message-requests/${requestId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, accept }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to respond");
      return;
    }
    load();
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      <h1>Message requests</h1>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {requests.length === 0 ? (
        <p style={{ color: "var(--color-muted)" }}>No pending requests.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {requests.map((request) => (
            <li key={request.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0 }}>
                <Link href={`/profile/${encodeURIComponent(request.from)}`}>
                  <strong>{request.from}</strong>
                </Link>
              </p>
              <p style={{ margin: "4px 0", fontSize: 14 }}>{request.text}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => respond(request.id, false)}>Decline</button>
                <button onClick={() => respond(request.id, true)}>Accept</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: 16, fontSize: 13 }}>
        <Link href={`/room/${DEFAULT_ROOM_ID}`}>Go to chat &rarr;</Link>
      </p>
    </main>
  );
}
