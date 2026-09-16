"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Tinder's real "Show a timer for time spent together after matching"
 * (#259) — an ascending "how long have we been matched" duration, the
 * opposite framing of #136/#137's descending MatchCountdown. Unlike
 * MatchCountdown, this never disappears once a first message is sent —
 * the point is celebrating an ongoing match, not urgency.
 */
export default function MatchTimer({ author, candidate }: { author: string; candidate: string }) {
  const [matchedAt, setMatchedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetch(`${API_URL}/api/matches/${encodeURIComponent(author)}/${encodeURIComponent(candidate)}/time-together`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setMatchedAt(body?.matchedAt ?? null))
      .catch(() => {});
  }, [author, candidate]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!matchedAt) return null;
  const elapsedMs = Math.max(0, now - new Date(matchedAt).getTime());

  return <span style={{ color: "var(--color-muted)", fontSize: 12 }}>💞 Matched {formatElapsed(elapsedMs)} ago</span>;
}
