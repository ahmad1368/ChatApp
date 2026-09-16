"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DURATIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 4, label: "4 hours" },
  { hours: 8, label: "8 hours" },
  { hours: 24, label: "24 hours" },
];

/**
 * Tinder's real "Ability to mute messages from a specific Match for a few
 * hours" (#311) — see muteMatch.ts. Their messages still arrive in the
 * chat; only the push notification is suppressed while muted.
 */
export default function MuteMatchControl({ viewer, match }: { viewer: string; match: string }) {
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_URL}/api/mute-match/${encodeURIComponent(viewer)}/${encodeURIComponent(match)}`)
      .then((res) => res.json())
      .then((body) => setMutedUntil(body.mutedUntil ?? null))
      .catch(() => {});
  };

  useEffect(load, [viewer, match]);

  const mute = async (hours: number) => {
    await fetch(`${API_URL}/api/mute-match/${encodeURIComponent(viewer)}/${encodeURIComponent(match)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    load();
  };

  const unmute = async () => {
    await fetch(`${API_URL}/api/mute-match/${encodeURIComponent(viewer)}/${encodeURIComponent(match)}`, { method: "DELETE" });
    setMutedUntil(null);
  };

  if (mutedUntil) {
    return (
      <button onClick={unmute} style={{ fontSize: 12 }}>
        🔕 Muted until {new Date(mutedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} — Unmute
      </button>
    );
  }

  return (
    <select
      value=""
      onChange={(e) => e.target.value && mute(Number(e.target.value))}
      aria-label={`Mute ${match}`}
      style={{ fontSize: 12 }}
    >
      <option value="">Mute for…</option>
      {DURATIONS.map((d) => (
        <option key={d.hours} value={d.hours}>
          {d.label}
        </option>
      ))}
    </select>
  );
}
