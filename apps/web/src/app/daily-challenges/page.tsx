"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Challenge {
  id: string;
  description: string;
  target: number;
  coinReward: number;
  progress: number;
  completed: boolean;
  rewardClaimed: boolean;
}

/**
 * Coffee Meets Bagel's real "Daily challenges (e.g., complete 3 prompt
 * answers or send 2 voice notes)" (#219) — see dailyChallenges.ts for
 * the honest scoping (a fixed daily checklist driven by real events
 * already happening elsewhere in the app).
 */
export default function DailyChallengesPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_URL}/api/daily-challenges/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setChallenges(body.challenges ?? []))
      .catch(() => {});
  };

  useEffect(load, [author]);

  const claim = async (challengeId: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/daily-challenges/${encodeURIComponent(author)}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to claim reward");
      return;
    }
    load();
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Daily Challenges</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {challenges.map((c) => (
          <div key={c.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
            <p style={{ fontWeight: 700, margin: "0 0 4px" }}>{c.description}</p>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 8px" }}>
              {c.progress}/{c.target} &middot; {c.coinReward} coins
            </p>
            <div style={{ background: "var(--color-border)", borderRadius: 4, height: 6, marginBottom: 8 }}>
              <div
                style={{ background: "var(--color-accent, #6d5ef8)", width: `${Math.min(100, (c.progress / c.target) * 100)}%`, height: 6, borderRadius: 4 }}
              />
            </div>
            {c.completed && !c.rewardClaimed && <button onClick={() => claim(c.id)}>Claim {c.coinReward} coins</button>}
            {c.rewardClaimed && <span style={{ fontSize: 13, color: "var(--color-muted)" }}>Claimed</span>}
          </div>
        ))}
      </div>
    </main>
  );
}
