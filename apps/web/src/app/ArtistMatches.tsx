"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ArtistMatchEntry {
  author: string;
  sharedArtists: string[];
  compatibility: number;
}

/**
 * Hinge's real "Show a list of shared favorite artists" (#326), same
 * shape as MusicMatches.tsx applied to Spotify top artists instead of top
 * tracks — see artistMatch.ts.
 */
export default function ArtistMatches({ author }: { author: string }) {
  const [matches, setMatches] = useState<ArtistMatchEntry[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/artist-matches/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMatches(body.candidates ?? []))
      .catch(() => {});
  }, [author]);

  if (matches.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>🎤 Same favorite artists</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {matches.map((entry) => (
          <div
            key={entry.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, maxWidth: 320 }}
          >
            <strong>{entry.author}</strong> &middot; {entry.compatibility}% match
            <div style={{ color: "var(--color-muted)", fontSize: 12 }}>You both love: {entry.sharedArtists.join(", ")}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
