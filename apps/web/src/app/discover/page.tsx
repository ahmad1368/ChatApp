"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";
import ExploreModeSelector from "../ExploreModeSelector";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SwipeCandidate {
  author: string;
  compatibility: number;
}

/**
 * Tinder's swipe-card interface (#91) — Like/Pass buttons rather than a
 * draggable gesture card: this app has no gesture-physics library
 * (react-native-reanimated/Framer Motion), and adding one is a bigger,
 * separate dependency decision than this issue's actual scope (the
 * decision engine in swipes.ts). Left/right/down arrow keys work as a
 * lightweight swipe stand-in (down = Super Like, #93), up rewinds (#92).
 * The "% match" badge is OkCupid's real interest-compatibility score
 * (#94), computed server-side from shared #79 interest tags.
 */
export default function DiscoverPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [candidates, setCandidates] = useState<SwipeCandidate[]>([]);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [lastSwiped, setLastSwiped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [superLikesRemaining, setSuperLikesRemaining] = useState(0);

  const loadCandidates = () => {
    fetch(`${API_URL}/api/swipe-candidates/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setCandidates(body.candidates ?? []))
      .catch(() => {});
  };

  const loadSuperLikesRemaining = () => {
    fetch(`${API_URL}/api/super-likes-remaining/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setSuperLikesRemaining(body.remaining ?? 0))
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API_URL}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    }).then(loadCandidates);
    loadSuperLikesRemaining();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  const swipe = async (direction: "like" | "pass" | "superlike") => {
    const candidate = candidates[0];
    if (!candidate || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/swipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swiper: author, swiped: candidate.author, direction }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to swipe");
      }
      if (body.matched) {
        setMatchNotice(candidate.author);
      } else {
        setMatchNotice(null);
      }
      setLastSwiped(candidate.author);
      setCandidates((prev) => prev.slice(1));
      if (direction === "superlike") {
        loadSuperLikesRemaining();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to swipe");
    } finally {
      setBusy(false);
    }
  };

  // Tinder's "Rewind" feature (#92) — undo only the single most recent
  // swipe, matching the server's own one-step-only rule.
  const undo = async () => {
    if (!lastSwiped || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/swipes/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to undo");
      }
      // Refetch rather than unshifting a bare name back on: the server
      // re-sorts by superliker-priority and #94's compatibility score,
      // which this client has no way to reconstruct locally.
      loadCandidates();
      setLastSwiped(null);
      setMatchNotice(null);
      loadSuperLikesRemaining();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to undo");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") swipe("like");
      if (e.key === "ArrowLeft") swipe("pass");
      if (e.key === "ArrowDown") swipe("superlike");
      if (e.key === "ArrowUp") undo();
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
      <ExploreModeSelector author={author} onChange={loadCandidates} />
      {matchNotice && (
        <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          🎉 It&apos;s a match with {matchNotice}!
        </div>
      )}
      {lastSwiped && (
        <button onClick={undo} disabled={busy} style={{ marginBottom: 8 }}>
          ↺ Rewind
        </button>
      )}
      {current ? (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 32, marginTop: 16 }}>
          <p style={{ fontSize: 20, fontWeight: "bold" }}>{current.author}</p>
          <p style={{ color: "var(--color-muted)", fontSize: 13 }}>{current.compatibility}% match</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
            <button onClick={() => swipe("pass")} disabled={busy} style={{ fontSize: 24 }}>
              ✕
            </button>
            <button
              onClick={() => swipe("superlike")}
              disabled={busy || superLikesRemaining <= 0}
              style={{ fontSize: 24 }}
              title={superLikesRemaining > 0 ? "Super Like" : "No Super Likes left today"}
            >
              ⭐
            </button>
            <button onClick={() => swipe("like")} disabled={busy} style={{ fontSize: 24 }}>
              ♥
            </button>
          </div>
          <p style={{ color: "var(--color-muted)", fontSize: 12, marginTop: 8 }}>
            {superLikesRemaining} Super Like{superLikesRemaining === 1 ? "" : "s"} left today
          </p>
        </div>
      ) : (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No more profiles right now — check back later.</p>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </main>
  );
}
