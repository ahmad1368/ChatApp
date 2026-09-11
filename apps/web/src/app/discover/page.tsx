"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";
import ExploreModeSelector from "../ExploreModeSelector";
import TopPicks from "../TopPicks";
import ProfileBoost from "../ProfileBoost";
import CrossedPaths from "../CrossedPaths";
import SharedContacts from "../SharedContacts";
import MusicMatches from "../MusicMatches";
import WeekendPlanMatches from "../WeekendPlanMatches";
import BioMatches from "../BioMatches";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SwipeCandidate {
  author: string;
  compatibility: number;
}

type ViewMode = "card" | "grid" | "list";

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
  const [likesRemaining, setLikesRemaining] = useState(0);
  const [bioKeyword, setBioKeyword] = useState("");
  const [viewMode, setViewModeState] = useState<ViewMode>("card");

  // OkCupid/Tinder's real bio keyword search (#113): a one-off query
  // string, not a persisted preference (see DiscoveryFiltersEditor for
  // the contrast) — narrows the same eligible pool the arrow-key swipe
  // deck already draws from.
  const loadCandidates = (keyword: string = bioKeyword) => {
    const query = keyword.trim() ? `?bioKeyword=${encodeURIComponent(keyword.trim())}` : "";
    fetch(`${API_URL}/api/swipe-candidates/${encodeURIComponent(author)}${query}`)
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

  // Coffee Meets Bagel/Tinder's real free-tier daily like limit (#116).
  const loadLikesRemaining = () => {
    fetch(`${API_URL}/api/likes-remaining/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setLikesRemaining(body.remaining ?? 0))
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API_URL}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    }).then(() => loadCandidates());
    loadSuperLikesRemaining();
    loadLikesRemaining();
    fetch(`${API_URL}/api/view-mode/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setViewModeState(body.mode ?? "card"))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  // OkCupid's real DoubleTake-style grid browsing (#115) — a persisted
  // preference (see viewMode.ts), not just local UI state, so it follows
  // the author across sessions/devices the same way #99's explore mode
  // choice does.
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    fetch(`${API_URL}/api/view-mode/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).catch(() => {});
  };

  const swipe = async (direction: "like" | "pass" | "superlike", targetAuthor?: string) => {
    const candidate = candidates.find((c) => c.author === targetAuthor) ?? candidates[0];
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
      setCandidates((prev) => prev.filter((c) => c.author !== candidate.author));
      if (direction === "superlike") {
        loadSuperLikesRemaining();
      }
      if (direction === "like") {
        loadLikesRemaining();
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
      loadLikesRemaining();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to undo");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't hijack arrow keys while the user is typing in the #113 bio
      // search box (or any future text input on this page).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
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
        <Link href="/">&larr; Back to chat</Link> &middot; <Link href="/matches">Your matches</Link> &middot;{" "}
        <Link href="/liked-you">Who liked you</Link> &middot; <Link href="/visitors">Profile visitors</Link> &middot;{" "}
        <Link href="/double-date">Double Date</Link> &middot; <Link href="/live-events">Live Events</Link>
      </p>
      <ProfileBoost author={author} />
      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "8px 0" }}>
        <input
          type="text"
          value={bioKeyword}
          onChange={(e) => setBioKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadCandidates(bioKeyword);
          }}
          placeholder="Search bios for a keyword"
          style={{ flex: 1, maxWidth: 240 }}
        />
        <button onClick={() => loadCandidates(bioKeyword)}>Search</button>
        {bioKeyword && (
          <button
            onClick={() => {
              setBioKeyword("");
              loadCandidates("");
            }}
          >
            Clear
          </button>
        )}
      </div>
      <ExploreModeSelector author={author} onChange={loadCandidates} />
      <TopPicks author={author} />
      <CrossedPaths author={author} />
      <SharedContacts author={author} />
      <MusicMatches author={author} />
      <WeekendPlanMatches author={author} />
      <BioMatches author={author} />
      {/* Web-only "grid or list" browsing (#115) — an alternative to the
          one-at-a-time swipe card, its own persisted preference. */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "8px 0" }} role="radiogroup" aria-label="Discovery view">
        {(["card", "grid", "list"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            aria-pressed={viewMode === mode}
            style={{ fontWeight: viewMode === mode ? "bold" : "normal" }}
          >
            {mode === "card" ? "🂠 Card" : mode === "grid" ? "▦ Grid" : "☰ List"}
          </button>
        ))}
      </div>
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
      {viewMode === "card" ? (
        current ? (
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 32, marginTop: 16 }}>
            <p style={{ fontSize: 20, fontWeight: "bold" }}>
              <Link href={`/profile/${encodeURIComponent(current.author)}`}>{current.author}</Link>
            </p>
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
              <button
                onClick={() => swipe("like")}
                disabled={busy || likesRemaining <= 0}
                style={{ fontSize: 24 }}
                title={likesRemaining > 0 ? "Like" : "No Likes left today"}
              >
                ♥
              </button>
            </div>
            <p style={{ color: "var(--color-muted)", fontSize: 12, marginTop: 8 }}>
              {superLikesRemaining} Super Like{superLikesRemaining === 1 ? "" : "s"} &middot; {likesRemaining} Like
              {likesRemaining === 1 ? "" : "s"} left today
            </p>
          </div>
        ) : (
          <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No more profiles right now — check back later.</p>
        )
      ) : candidates.length > 0 ? (
        <div
          style={
            viewMode === "grid"
              ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginTop: 16 }
              : { display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }
          }
        >
          {candidates.map((candidate) => (
            <div
              key={candidate.author}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 12,
                display: "flex",
                flexDirection: viewMode === "grid" ? "column" : "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <Link href={`/profile/${encodeURIComponent(candidate.author)}`} style={{ fontWeight: "bold" }}>
                  {candidate.author}
                </Link>
                <p style={{ color: "var(--color-muted)", fontSize: 12, margin: 0 }}>{candidate.compatibility}% match</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => swipe("pass", candidate.author)} disabled={busy}>
                  ✕
                </button>
                <button
                  onClick={() => swipe("like", candidate.author)}
                  disabled={busy || likesRemaining <= 0}
                  title={likesRemaining > 0 ? "Like" : "No Likes left today"}
                >
                  ♥
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No more profiles right now — check back later.</p>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </main>
  );
}
