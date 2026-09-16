"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface MoodMatchEntry {
  author: string;
  compatibility: number;
  moodLabel: string;
}

/**
 * Hinge's real "System to analyze mood compatibility based on music"
 * (#293) — ranks by overall music VIBE (Spotify's real valence/energy
 * audio features), not literal shared tracks like #118's MusicMatches —
 * see musicMood.ts. Only shows up once the viewer has connected Spotify
 * themselves and hasn't hidden it, same gating as MusicMatches.tsx.
 */
export default function MoodCompatibility({ author }: { author: string }) {
  const [matches, setMatches] = useState<MoodMatchEntry[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/mood-compatibility/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMatches(body.candidates ?? []))
      .catch(() => {});
  }, [author]);

  if (matches.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>🎧 Mood compatibility</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {matches.map((entry) => (
          <div
            key={entry.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, maxWidth: 320 }}
          >
            <strong>{entry.author}</strong> &middot; {entry.compatibility}% mood match
            <div style={{ color: "var(--color-muted)", fontSize: 12 }}>Their vibe: {entry.moodLabel}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
