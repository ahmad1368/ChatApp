"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ZodiacMatchEntry {
  author: string;
  zodiacSign: string;
  score: number;
  relationship: "same-element" | "complementary" | "neutral" | "clashing";
}

const RELATIONSHIP_LABEL: Record<ZodiacMatchEntry["relationship"], string> = {
  "same-element": "Same element",
  complementary: "Complementary elements",
  neutral: "Neutral",
  clashing: "Clashing elements",
};

/**
 * Hinge's real "Ability to measure zodiac sign compatibility by birth
 * month" (#255) — same shape as WeekendPlanMatches.tsx/MusicMatches.tsx
 * applied to #72's zodiac signs — see zodiacCompatibility.ts.
 */
export default function ZodiacMatches({ author }: { author: string }) {
  const [matches, setMatches] = useState<ZodiacMatchEntry[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/zodiac-matches/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMatches(body.candidates ?? []))
      .catch(() => {});
  }, [author]);

  if (matches.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>♈ Zodiac compatibility</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {matches.map((entry) => (
          <div
            key={entry.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, maxWidth: 320 }}
          >
            <strong>{entry.author}</strong> ({entry.zodiacSign}) &middot; {entry.score}% match
            <div style={{ color: "var(--color-muted)", fontSize: 12 }}>{RELATIONSHIP_LABEL[entry.relationship]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
