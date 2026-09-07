"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface MusicMatchEntry {
  author: string;
  sharedTracks: string[];
  compatibility: number;
}

/**
 * Hinge's real "you both like X" shared-interest framing (#118), applied
 * to #77's Spotify top tracks — see musicMatch.ts. Only shows up once the
 * viewer has connected Spotify themselves (via SpotifyConnect on
 * /settings/profile) and hasn't hidden it.
 */
export default function MusicMatches({ author }: { author: string }) {
  const [matches, setMatches] = useState<MusicMatchEntry[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/music-matches/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMatches(body.candidates ?? []))
      .catch(() => {});
  }, [author]);

  if (matches.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>🎵 Shared music taste</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {matches.map((entry) => (
          <div
            key={entry.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, maxWidth: 320 }}
          >
            <strong>{entry.author}</strong> &middot; {entry.compatibility}% match
            <div style={{ color: "var(--color-muted)", fontSize: 12 }}>You both like: {entry.sharedTracks.join(", ")}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
