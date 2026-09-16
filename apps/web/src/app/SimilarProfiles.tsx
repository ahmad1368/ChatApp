"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SimilarProfile {
  author: string;
  similarity: number;
}

/**
 * Tinder's real "Show similar profiles based on a selected pattern"
 * (#284) — `selectedAuthor` is the profile being viewed (the "pattern"),
 * ranked by interest similarity to that SAME profile rather than to
 * `viewer` — see similarProfiles.ts. Renders nothing below a similarity
 * of 0 (no shared signal at all isn't a useful recommendation).
 */
export default function SimilarProfiles({ viewer, selectedAuthor }: { viewer: string; selectedAuthor: string }) {
  const [profiles, setProfiles] = useState<SimilarProfile[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/similar-profiles/${encodeURIComponent(viewer)}/${encodeURIComponent(selectedAuthor)}`)
      .then((res) => res.json())
      .then((body) => setProfiles((body.profiles ?? []).filter((p: SimilarProfile) => p.similarity > 0)))
      .catch(() => {});
  }, [viewer, selectedAuthor]);

  if (profiles.length === 0) return null;

  return (
    <section style={{ marginTop: 16 }}>
      <p style={{ fontWeight: "bold", fontSize: 14, marginBottom: 6 }}>Similar profiles</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {profiles.map((p) => (
          <Link
            key={p.author}
            href={`/profile/${encodeURIComponent(p.author)}`}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "6px 10px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{p.author}</span>
            <span style={{ color: "var(--color-muted)", fontSize: 12 }}>{p.similarity}% similar</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
