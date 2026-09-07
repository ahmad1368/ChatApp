"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SmartScore {
  desirabilityRating: number;
  activityCount: number;
}

/**
 * Tinder's real "Elo Score"/"Smart Score" (#95) — shown here only to the
 * profile owner, on their own settings page, never alongside candidates in
 * /discover. Surfacing another profile's desirability rating would let
 * people rank/filter each other by it directly, exactly the outcome real
 * Tinder kept this score unpublished to avoid.
 */
export default function SmartScoreDisplay({ author }: { author: string }) {
  const [score, setScore] = useState<SmartScore | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/smart-score/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setScore(body.score ?? null))
      .catch(() => {});
  }, [author]);

  if (!score) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Your Smart Score</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Visible only to you — never shown to other profiles.
      </p>
      <p>Desirability rating: {score.desirabilityRating}</p>
      <p>Swipes given: {score.activityCount}</p>
    </section>
  );
}
