"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SessionInfo {
  sessionKey: string;
  startsAt: string;
  participants: string[];
}

interface Round {
  round: number;
  pairs: Array<[string, string]>;
}

/**
 * Match.com's real "Speed Dating event at set times of the week" (#216)
 * — see speedDating.ts for the honest scoping (a fixed weekly UTC slot,
 * a real round-robin pairing into timed rounds, and mutual interest
 * revealed only once both sides express it).
 */
export default function SpeedDatingPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [joined, setJoined] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_URL}/api/speed-dating/next-session`)
      .then((res) => res.json())
      .then((body) => {
        setSession(body);
        setJoined(body.participants.includes(author));
      })
      .catch(() => {});
  };

  useEffect(load, [author]);

  const join = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/speed-dating/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to join");
      return;
    }
    setSession(body);
    setJoined(true);
  };

  const generateRounds = async () => {
    if (!session) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/speed-dating/${session.sessionKey}/generate-rounds`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to generate rounds");
      return;
    }
    setRounds(body.rounds);
  };

  const expressInterest = async (partner: string) => {
    if (!session) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/speed-dating/${session.sessionKey}/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, partner }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to express interest");
      return;
    }
    if (body.matched) {
      const matchesRes = await fetch(`${API_URL}/api/speed-dating/${session.sessionKey}/matches?author=${encodeURIComponent(author)}`);
      setMatches((await matchesRes.json()).matches ?? []);
    }
  };

  const myPartners = rounds.flatMap((r) => r.pairs).filter(([a, b]) => a === author || b === author).map(([a, b]) => (a === author ? b : a));

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Speed Dating</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {session && (
        <p style={{ color: "var(--color-muted)" }}>
          Next session: {new Date(session.startsAt).toLocaleString()} &middot; {session.participants.length} joined
        </p>
      )}

      {!joined && (
        <button onClick={join}>Join this week's speed dating</button>
      )}

      {joined && rounds.length === 0 && <button onClick={generateRounds}>Start rounds</button>}

      {myPartners.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {myPartners.map((partner) => (
            <div key={partner} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{partner}</span>
              <button onClick={() => expressInterest(partner)} disabled={matches.includes(partner)}>
                {matches.includes(partner) ? "Matched!" : "I'm interested"}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
