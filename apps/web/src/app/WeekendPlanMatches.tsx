"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface WeekendPlanMatchEntry {
  author: string;
  sharedPlans: string[];
  compatibility: number;
}

/**
 * Tinder/Hinge's "what are you up to this weekend" suggestion (#119), same
 * shape as MusicMatches.tsx applied to weekend-plan tags instead of
 * Spotify top tracks — see weekendPlanMatch.ts.
 */
export default function WeekendPlanMatches({ author }: { author: string }) {
  const [matches, setMatches] = useState<WeekendPlanMatchEntry[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/weekend-plan-matches/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMatches(body.candidates ?? []))
      .catch(() => {});
  }, [author]);

  if (matches.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>📅 Same weekend plans</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {matches.map((entry) => (
          <div
            key={entry.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, maxWidth: 320 }}
          >
            <strong>{entry.author}</strong> &middot; {entry.compatibility}% match
            <div style={{ color: "var(--color-muted)", fontSize: 12 }}>You're both up for: {entry.sharedPlans.join(", ")}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
