"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Show the number of successful matches recorded in the
 * app" (#278) — the same real, live match count #171's admin dashboard
 * already computes, just shown publicly as the social-proof stat real
 * dating apps advertise (e.g. Tinder's own "billions of matches" line).
 */
export default function TotalMatchesBadge() {
  const [totalMatches, setTotalMatches] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/stats/matches`)
      .then((res) => res.json())
      .then((body) => setTotalMatches(body.totalMatches ?? null))
      .catch(() => {});
  }, []);

  if (totalMatches === null) return null;

  return (
    <p style={{ textAlign: "center", color: "var(--color-muted)", fontSize: 13, margin: "4px 0 12px" }}>
      🎉 {totalMatches.toLocaleString()} match{totalMatches === 1 ? "" : "es"} made on ChatApp so far
    </p>
  );
}
