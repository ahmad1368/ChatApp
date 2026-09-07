"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface TopPick {
  author: string;
  desirabilityRating: number;
}

/**
 * Tinder's real "Top Picks" (#101): a small, once-a-day curated list —
 * see topPicks.ts for why it's ranked by #95's Smart Score desirability
 * rating rather than a separate quality model, and why it's cached for
 * the day rather than re-ranked on every load.
 */
export default function TopPicks({ author }: { author: string }) {
  const [picks, setPicks] = useState<TopPick[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/top-picks/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setPicks(body.picks ?? []))
      .catch(() => {});
  }, [author]);

  if (picks.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>✨ Today&apos;s Top Picks</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {picks.map((pick) => (
          <div
            key={pick.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}
          >
            {pick.author}
          </div>
        ))}
      </div>
    </section>
  );
}
