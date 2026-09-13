"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SpinSegment {
  coins: number;
  weight: number;
}

interface SpinStatus {
  canSpin: boolean;
  segments: SpinSegment[];
  nextSpinAt: string | null;
}

/**
 * Coffee Meets Bagel's real "Daily Spin wheel to earn free coins" (#211)
 * — see dailySpin.ts for the honest scoping (one real weighted-random
 * spin per UTC day, credited to the #196 coin balance).
 */
export default function DailySpinPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [status, setStatus] = useState<SpinStatus | null>(null);
  const [balance, setBalance] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_URL}/api/daily-spin/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => {});
    fetch(`${API_URL}/api/coins/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setBalance(body.balance ?? 0))
      .catch(() => {});
  };

  useEffect(load, [author]);

  const spin = async () => {
    setError(null);
    setResult(null);
    setSpinning(true);
    try {
      const res = await fetch(`${API_URL}/api/daily-spin/${encodeURIComponent(author)}/spin`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to spin");
        return;
      }
      setResult(body.coinsWon);
      setBalance(body.balance);
      setStatus((prev) => (prev ? { ...prev, canSpin: false, nextSpinAt: body.nextSpinAt } : prev));
    } finally {
      setSpinning(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link> &middot; <Link href="/coins">Coins</Link>
      </p>
      <h1>Daily Spin</h1>
      <p style={{ fontSize: 18, fontWeight: 700 }}>{balance} coins</p>
      <p style={{ color: "var(--color-muted)" }}>Spin once a day for a free chance at bonus coins.</p>

      {status && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {status.segments.map((segment) => (
            <div
              key={segment.coins}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: "8px 12px",
                fontWeight: 700,
                flex: "1 1 70px",
                textAlign: "center",
              }}
            >
              {segment.coins}
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {result !== null && <p style={{ fontSize: 20, fontWeight: 700 }}>You won {result} coins!</p>}

      <button onClick={spin} disabled={spinning || !status?.canSpin}>
        {status?.canSpin ? (spinning ? "Spinning..." : "Spin the wheel") : "Come back tomorrow"}
      </button>

      {!status?.canSpin && status?.nextSpinAt && (
        <p style={{ color: "var(--color-muted)", fontSize: 13 }}>Next spin available at {new Date(status.nextSpinAt).toLocaleString()}</p>
      )}
    </main>
  );
}
