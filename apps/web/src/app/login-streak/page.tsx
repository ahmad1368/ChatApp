"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface StreakReward {
  day: number;
  coins: number;
}

interface CheckInResponse {
  streak: number;
  coinsAwarded: number;
  alreadyCheckedInToday: boolean;
  balance: number;
}

/**
 * Tinder's real "Reward for consecutive daily logins (Daily Streak)"
 * (#212) — see loginStreak.ts for the honest scoping (a real 7-day
 * reward cycle, credited to the #196 coin balance once per UTC day).
 * Visiting this page is this app's "login" event: check-in fires
 * automatically on mount, and repeat visits the same day are a no-op.
 */
export default function LoginStreakPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [rewards, setRewards] = useState<StreakReward[]>([]);
  const [checkIn, setCheckIn] = useState<CheckInResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/login-streak/${encodeURIComponent(author)}/check-in`, { method: "POST" })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setCheckIn(body);
      })
      .catch(() => setError("Failed to check in"));

    fetch(`${API_URL}/api/login-streak/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setRewards(body.rewards ?? []))
      .catch(() => {});
  }, [author]);

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link> &middot; <Link href="/coins">Coins</Link>
      </p>
      <h1>Daily Streak</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {checkIn && (
        <p style={{ fontSize: 18, fontWeight: 700 }}>
          {checkIn.alreadyCheckedInToday
            ? `You're on a ${checkIn.streak}-day streak — come back tomorrow for your next reward.`
            : `Day ${checkIn.streak} streak! +${checkIn.coinsAwarded} coins (balance: ${checkIn.balance})`}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {rewards.map((reward) => {
          const isToday = checkIn ? (checkIn.streak - 1) % rewards.length === reward.day - 1 : false;
          return (
            <div
              key={reward.day}
              style={{
                border: isToday ? "2px solid var(--color-accent, #6d5ef8)" : "1px solid var(--color-border)",
                borderRadius: 8,
                padding: "8px 12px",
                textAlign: "center",
                flex: "1 1 60px",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>Day {reward.day}</div>
              <div style={{ fontWeight: 700 }}>{reward.coins}</div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
