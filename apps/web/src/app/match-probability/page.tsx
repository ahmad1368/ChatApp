"use client";

import { useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const SIGNAL_LABEL: Record<string, string> = {
  interests: "Shared interests",
  music: "Music taste",
  weekendPlans: "Weekend plans",
  bio: "Bio overlap",
  conversation: "Actual conversation",
};

interface MatchSignal {
  label: string;
  score: number;
  weight: number;
}

interface MatchProbabilityResult {
  hasEnoughData: boolean;
  probability: number;
  confidence: "low" | "medium" | "high";
  signals: MatchSignal[];
}

/**
 * eHarmony's real "Predict relationship success probability (Match
 * Probability Score)" (#238) — see matchProbability.ts for the honest
 * scoping (a weighted composite of every real compatibility signal this
 * app already computes).
 */
export default function MatchProbabilityPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [otherAuthor, setOtherAuthor] = useState("");
  const [roomId, setRoomId] = useState("");
  const [result, setResult] = useState<MatchProbabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getScore = async () => {
    setError(null);
    const params = new URLSearchParams({ authorA: author, authorB: otherAuthor });
    if (roomId.trim()) params.set("roomId", roomId.trim());
    const res = await fetch(`${API_URL}/api/match-probability?${params.toString()}`);
    if (!res.ok) {
      setError("Failed to compute match probability");
      return;
    }
    setResult(await res.json());
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Match Probability</h1>
      <p style={{ color: "var(--color-muted)" }}>A real composite of every compatibility signal this app has for you and a match.</p>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <input
        value={otherAuthor}
        onChange={(e) => setOtherAuthor(e.target.value)}
        placeholder="The other person's name"
        style={{ width: "100%", marginBottom: 8 }}
      />
      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="Room ID (optional, includes your conversation)"
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button onClick={getScore} disabled={!otherAuthor.trim()}>
        Calculate
      </button>

      {result && !result.hasEnoughData && (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>
          Not enough shared data yet to estimate this — fill out more of your profile or chat a bit first.
        </p>
      )}

      {result && result.hasEnoughData && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 16 }}>
          <p style={{ margin: 0 }}>
            <strong style={{ fontSize: 24 }}>{result.probability}%</strong> match probability
          </p>
          <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 12px" }}>Confidence: {result.confidence}</p>
          <ul style={{ paddingLeft: 20, fontSize: 13 }}>
            {result.signals.map((s) => (
              <li key={s.label}>
                {SIGNAL_LABEL[s.label] ?? s.label}: {s.score}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
