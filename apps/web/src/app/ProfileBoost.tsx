"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const TIER_LABELS: Record<string, string> = { boost: "🚀 Boost", superboost: "⚡ Super Boost" };

/**
 * Tinder's real "Boost"/"Super Boost" (#105, extended by #106): activating
 * puts this author at the front of everyone else's discovery order for 30
 * minutes, with Super Boost outranking a plain Boost — see profileBoost.ts
 * and swipes.ts's getCandidates for the ranking rule. The peak-hours hint
 * is #106's "smart" half: it tells the user when boosting will actually
 * reach the most people, based on real recorded swipe activity (see
 * peakHours.ts) rather than leaving them to guess. Free here since this
 * app has no premium tier to gate either behind.
 */
export default function ProfileBoost({ author }: { author: string }) {
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [isPeakHourNow, setIsPeakHourNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  const load = () => {
    fetch(`${API_URL}/api/profile-boost/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setExpiresAt(body.active ? body.expiresAt : null);
        setTier(body.active ? body.tier : null);
      })
      .catch(() => {});
  };

  useEffect(load, [author]);

  useEffect(() => {
    fetch(`${API_URL}/api/peak-hours`)
      .then((res) => res.json())
      .then((body) => setIsPeakHourNow(body.isPeakHourNow ?? false))
      .catch(() => {});
  }, [author]);

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

  const activate = async (selectedTier: "boost" | "superboost") => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/profile-boost/${encodeURIComponent(author)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to activate Boost");
      }
      setExpiresAt(body.expiresAt);
      setTier(body.tier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate Boost");
    } finally {
      setBusy(false);
    }
  };

  const active = remainingMs > 0;

  return (
    <div style={{ marginBottom: 12 }}>
      {active ? (
        <p>
          {tier ? TIER_LABELS[tier] : "🚀 Boosted"} active ({formatRemaining(remainingMs)})
        </p>
      ) : (
        <>
          {isPeakHourNow && (
            <p style={{ color: "var(--color-muted)", fontSize: 12 }}>
              🔥 Right now is a peak activity hour — a great time to boost.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => activate("boost")} disabled={busy}>
              🚀 Boost my profile
            </button>
            <button onClick={() => activate("superboost")} disabled={busy}>
              ⚡ Super Boost
            </button>
          </div>
        </>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
