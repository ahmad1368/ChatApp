"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's swipe-card interface (#91) — Like/Pass buttons rather than a
 * draggable gesture card: this app has no gesture-physics library
 * (react-native-reanimated/Framer Motion), and adding one is a bigger,
 * separate dependency decision than this issue's actual scope (the
 * decision engine in swipes.ts). Left and right arrow keys work as a
 * lightweight swipe stand-in.
 */
export default function DiscoverPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [candidates, setCandidates] = useState<string[]>([]);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = () => {
    fetch(`${API_URL}/api/swipe-candidates/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setCandidates(body.candidates ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API_URL}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    }).then(loadCandidates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  const swipe = async (direction: "like" | "pass") => {
    const candidate = candidates[0];
    if (!candidate || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/swipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swiper: author, swiped: candidate, direction }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to swipe");
      }
      if (body.matched) {
        setMatchNotice(candidate);
      }
      setCandidates((prev) => prev.slice(1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to swipe");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") swipe("like");
      if (e.key === "ArrowLeft") swipe("pass");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, busy]);

  const current = candidates[0];

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>Discover</h1>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      {matchNotice && (
        <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          🎉 It&apos;s a match with {matchNotice}!
        </div>
      )}
      {current ? (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 32, marginTop: 16 }}>
          <p style={{ fontSize: 20, fontWeight: "bold" }}>{current}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
            <button onClick={() => swipe("pass")} disabled={busy} style={{ fontSize: 24 }}>
              ✕
            </button>
            <button onClick={() => swipe("like")} disabled={busy} style={{ fontSize: 24 }}>
              ♥
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No more profiles right now — check back later.</p>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </main>
  );
}
