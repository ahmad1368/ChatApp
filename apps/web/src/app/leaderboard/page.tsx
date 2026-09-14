"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface LeaderboardEntry {
  author: string;
  activityCount: number;
  popularityCount: number;
  totalScore: number;
}

/**
 * Hinge's real "Weekly leaderboards based on activity/popularity"
 * (#220) — see weeklyLeaderboard.ts for the honest scoping (a rolling
 * 7-day window combining real swipe activity and real likes received).
 */
export default function LeaderboardPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/leaderboard/weekly?limit=20`)
      .then((res) => res.json())
      .then((body) => {
        setEntries(body.entries ?? []);
        setWeekStart(body.weekStart ?? null);
      })
      .catch(() => {});
    fetch(`${API_URL}/api/leaderboard/weekly/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMyRank(body.rank))
      .catch(() => {});
  }, [author]);

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Weekly Leaderboard</h1>
      {weekStart && <p style={{ color: "var(--color-muted)", fontSize: 13 }}>Week of {new Date(weekStart).toLocaleDateString()}</p>}
      {myRank !== null && <p style={{ fontWeight: 700 }}>Your rank: #{myRank}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
        {entries.map((entry, i) => (
          <div
            key={entry.author}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 10,
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontWeight: entry.author === author ? 700 : 400,
            }}
          >
            <span>
              #{i + 1} {entry.author}
            </span>
            <span style={{ color: "var(--color-muted)", fontSize: 13 }}>
              {entry.activityCount} swipes &middot; {entry.popularityCount} likes
            </span>
          </div>
        ))}
        {entries.length === 0 && <p style={{ color: "var(--color-muted)" }}>No activity yet this week.</p>}
      </div>
    </main>
  );
}
