"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ActivityLevel {
  activityCount: number;
  percentile: number;
}

/**
 * Tinder's real "Ability to measure user activity level as a percentage"
 * (#252) — same "visible only to you" reasoning as #95's
 * SmartScoreDisplay: surfacing another profile's comparative activity
 * ranking would let people filter/judge each other by it.
 */
export default function ActivityLevelDisplay({ author }: { author: string }) {
  const [level, setLevel] = useState<ActivityLevel | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/activity-level/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setLevel(body ?? null))
      .catch(() => {});
  }, [author]);

  if (!level) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Your activity level</h2>
      <p style={{ color: "var(--color-muted)" }}>Visible only to you — never shown to other profiles.</p>
      <p>
        More active than {level.percentile}% of tracked users ({level.activityCount} swipes)
      </p>
    </section>
  );
}
