"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface BioMatchEntry {
  author: string;
  sharedKeywords: string[];
  compatibility: number;
}

/**
 * "Use AI to analyze bio text and improve matching" (#120) — an honest
 * keyword-extraction heuristic over bio text, not an invented LLM
 * integration — see bioAnalysis.ts. Same shape as MusicMatches.tsx /
 * WeekendPlanMatches.tsx.
 */
export default function BioMatches({ author }: { author: string }) {
  const [matches, setMatches] = useState<BioMatchEntry[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/bio-matches/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMatches(body.candidates ?? []))
      .catch(() => {});
  }, [author]);

  if (matches.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>✨ Similar bios</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {matches.map((entry) => (
          <div
            key={entry.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, maxWidth: 320 }}
          >
            <strong>{entry.author}</strong> &middot; {entry.compatibility}% match
            <div style={{ color: "var(--color-muted)", fontSize: 12 }}>You both mention: {entry.sharedKeywords.join(", ")}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
