"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface BlindChatStatus {
  photosRevealed: boolean;
  revealAt: string;
  secondsRemaining: number;
  revealRequestedByMe: boolean;
  bothRequestedReveal: boolean;
}

/**
 * Hinge's real "Blind Chat without seeing photos for the first few
 * minutes" (#217) — see blindChat.ts for the honest scoping (a real
 * per-pair timer, with an early reveal only taking effect once both
 * sides request it).
 */
export default function BlindChatPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [partner, setPartner] = useState("");
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<BlindChatStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!active || !partner.trim()) return;
    fetch(`${API_URL}/api/blind-chat/status?author=${encodeURIComponent(author)}&partner=${encodeURIComponent(partner.trim())}`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => {});
  };

  useEffect(() => {
    if (!active) return;
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [active, partner]);

  const start = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/blind-chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, partner: partner.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to start");
      return;
    }
    setStatus(body);
    setActive(true);
  };

  const requestReveal = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/blind-chat/reveal-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, partner: partner.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to request reveal");
      return;
    }
    setStatus(body);
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Blind Chat</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {!active && (
        <div style={{ display: "flex", gap: 8 }}>
          <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Match's name" style={{ flex: 1 }} />
          <button onClick={start} disabled={!partner.trim()}>
            Start Blind Chat
          </button>
        </div>
      )}

      {status && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "var(--color-border)",
              filter: status.photosRevealed ? "none" : "blur(16px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            {partner}
          </div>

          {status.photosRevealed ? (
            <p style={{ fontWeight: 700 }}>Photos revealed!</p>
          ) : (
            <>
              <p>Photos reveal in {Math.ceil(status.secondsRemaining / 60)} min</p>
              <button onClick={requestReveal} disabled={status.revealRequestedByMe}>
                {status.revealRequestedByMe ? "Waiting for them to agree..." : "Ask to reveal now"}
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
