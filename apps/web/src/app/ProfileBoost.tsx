"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Tinder's real "Boost" (#105): activating puts this author at the front
 * of everyone else's discovery order for 30 minutes — see profileBoost.ts
 * and swipes.ts's getCandidates for the ranking rule. Free here since
 * this app has no premium tier to gate it behind.
 */
export default function ProfileBoost({ author }: { author: string }) {
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  const load = () => {
    fetch(`${API_URL}/api/profile-boost/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setExpiresAt(body.active ? body.expiresAt : null))
      .catch(() => {});
  };

  useEffect(load, [author]);

  useEffect(() => {
    clearInterval(tickRef.current);
    if (!expiresAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () => setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickRef.current);
  }, [expiresAt]);

  const activate = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/profile-boost/${encodeURIComponent(author)}`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to activate Boost");
      }
      setExpiresAt(body.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate Boost");
    } finally {
      setBusy(false);
    }
  };

  const active = remainingMs > 0;

  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={activate} disabled={busy || active}>
        {active ? `🚀 Boosted (${formatRemaining(remainingMs)})` : "🚀 Boost my profile"}
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
