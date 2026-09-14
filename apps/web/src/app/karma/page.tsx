"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Scoring system for positive behavior (Karma / Respect
 * Score)" (#218) — see karmaScore.ts for the honest scoping (everyone
 * starts at 80/100, moving from real report/block/match signals already
 * tracked elsewhere in this app).
 */
export default function KarmaPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/karma/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setScore(body.score))
      .catch(() => {});
  }, [author]);

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Respect Score</h1>

      {score !== null && (
        <>
          <p style={{ fontSize: 40, fontWeight: 700, margin: "16px 0 4px" }}>{score}/100</p>
          <div style={{ background: "var(--color-border)", borderRadius: 4, height: 10 }}>
            <div style={{ background: "var(--color-accent, #6d5ef8)", width: `${score}%`, height: 10, borderRadius: 4 }} />
          </div>
          <p style={{ color: "var(--color-muted)", fontSize: 13, marginTop: 12 }}>
            Everyone starts at 80. Matching with people raises your score; being reported or blocked lowers it.
          </p>
        </>
      )}
    </main>
  );
}
