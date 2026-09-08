"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Bumble's real "24-hour timer to respond to the first message before the
 * Match expires" (#136) — a live countdown so it's not a surprise when
 * the match disappears. Renders nothing once a first message has already
 * been sent (the clock stopped) or if this pair isn't tracked at all
 * (matched before this feature existed).
 */
export default function MatchCountdown({ author, candidate }: { author: string; candidate: string }) {
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [firstMessageSent, setFirstMessageSent] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetch(`${API_URL}/api/matches/${encodeURIComponent(author)}/${encodeURIComponent(candidate)}/expiry`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body) return;
        setExpiresAt(body.expiresAt);
        setFirstMessageSent(Boolean(body.firstMessageSentAt));
      })
      .catch(() => {});
  }, [author, candidate]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!expiresAt || firstMessageSent) return null;
  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) return null;

  return (
    <p style={{ color: "var(--color-danger)", fontSize: 12, margin: "2px 0 0" }}>
      ⏳ {formatRemaining(remainingMs)} left to say something
    </p>
  );
}
