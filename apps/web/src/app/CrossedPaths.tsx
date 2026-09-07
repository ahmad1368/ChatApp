"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface CrossedPathEntry {
  author: string;
  compatibility: number;
}

/**
 * Tinder's real (now-discontinued) "Crossed Paths" (#108): people whose
 * recent real-world location physically overlapped with yours — see
 * crossedPaths.ts for the ping/threshold/window rules and the honest
 * limitation on tracking resolution without a background location
 * service. Sharing your location via /privacy/location feeds this.
 */
export default function CrossedPaths({ author }: { author: string }) {
  const [crossedPaths, setCrossedPaths] = useState<CrossedPathEntry[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/crossed-paths/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setCrossedPaths(body.crossedPaths ?? []))
      .catch(() => {});
  }, [author]);

  if (crossedPaths.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>📍 Crossed Paths</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {crossedPaths.map((entry) => (
          <div
            key={entry.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}
          >
            {entry.author}
          </div>
        ))}
      </div>
    </section>
  );
}
