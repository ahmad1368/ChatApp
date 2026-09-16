"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";
import ExploreModeSelector from "../ExploreModeSelector";
import TopPicks from "../TopPicks";
import ProfileBoost from "../ProfileBoost";
import CrossedPaths from "../CrossedPaths";
import SharedContacts from "../SharedContacts";
import FacebookMutualConnections from "../FacebookMutualConnections";
import MusicMatches from "../MusicMatches";
import WeekendPlanMatches from "../WeekendPlanMatches";
import ZodiacMatches from "../ZodiacMatches";
import BioMatches from "../BioMatches";
import AdBanner from "../AdBanner";
import VoiceSwipeControl from "../VoiceSwipeControl";
import ProfileShareButton from "../ProfileShareButton";
import TotalMatchesBadge from "../TotalMatchesBadge";
import WeatherBadge from "../WeatherBadge";
import LottieAnimation from "../LottieAnimation";
import { vibrateForeground, vibrationPatternForCategory } from "../notificationSound";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SwipeCandidate {
  author: string;
  compatibility: number;
  distanceKm: number | null;
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
  const [superLikeCredits, setSuperLikeCredits] = useState(0);
  const [superLikePackages, setSuperLikePackages] = useState<{ id: string; superLikes: number; coinCost: number }[]>([]);
  const [likesRemaining, setLikesRemaining] = useState(0);
  const [rewindsRemaining, setRewindsRemaining] = useState(1);
  const [unlimitedRewinds, setUnlimitedRewinds] = useState(false);
  const [bioKeyword, setBioKeyword] = useState("");
  const [viewMode, setViewModeState] = useState<ViewMode>("card");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

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

  // Tinder's real "Purchase a separate Super Like package" (#199) —
  // see swipes.ts for the honest scoping (a coin-priced credit covers a
  // Super Like once the free daily allowance above is used up).
  const loadSuperLikeCredits = () => {
    fetch(`${API_URL}/api/super-likes/${encodeURIComponent(author)}/credits`)
      .then((res) => res.json())
      .then((body) => setSuperLikeCredits(body.credits ?? 0))
      .catch(() => {});
  };

  const purchaseSuperLikePackage = (packageId: string) => {
    fetch(`${API_URL}/api/super-likes/${encodeURIComponent(author)}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (ok) setSuperLikeCredits(body.credits);
        else setError(body.error ?? "Failed to purchase Super Like package");
      })
      .catch(() => setError("Failed to purchase Super Like package"));
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
    loadSuperLikeCredits();
    loadRewindsRemaining();
    fetch(`${API_URL}/api/super-likes/packages`)
      .then((res) => res.json())
      .then((body) => setSuperLikePackages(body.packages ?? []))
      .catch(() => {});
    loadLikesRemaining();
    fetch(`${API_URL}/api/view-mode/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setViewModeState(body.mode ?? "card"))
      .catch(() => {});
    fetch(`${API_URL}/api/favorites/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setFavorites(new Set<string>(body.favorites ?? [])))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  // Tinder's real "Ability to define a favorites list" (#279) — bookmark
  // any candidate for later without swiping on them. See favorites.ts.
  const toggleFavorite = (targetAuthor: string) => {
    const isFavorited = favorites.has(targetAuthor);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFavorited) next.delete(targetAuthor);
      else next.add(targetAuthor);
      return next;
    });
    fetch(`${API_URL}/api/favorites`, {
      method: isFavorited ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewerAuthor: author, targetAuthor }),
    }).catch(() => {});
  };

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
        // Bumble's real "Haptic feedback on like or Match" (#248): the
        // browser's own real Vibration API (navigator.vibrate) — only
        // Android Chrome/Firefox actually implement it (iOS Safari has no
        // Vibration API at all), an honest, disclosed platform gap rather
        // than a fabricated cross-platform haptics layer. Reuses the same
        // per-category patterns #160's push vibration already defines, so
        // a match feels like the same celebratory double-buzz whether it
        // arrives as a push notification or happens live on this screen.
        vibrateForeground(vibrationPatternForCategory("newMatch"));
      } else {
        setMatchNotice(null);
        if (direction === "like" || direction === "superlike") {
          vibrateForeground(vibrationPatternForCategory("newLike"));
        }
      }
      setLastSwiped(candidate.author);
      setCandidates((prev) => prev.filter((c) => c.author !== candidate.author));
      if (direction === "superlike") {
        loadSuperLikesRemaining();
        loadSuperLikeCredits();
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

  // #209's real daily Rewind cap (and purchasable unlimited removal of
  // it) — see swipes.ts for the honest scoping.
  const loadRewindsRemaining = () => {
    fetch(`${API_URL}/api/rewinds-remaining/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setRewindsRemaining(body.remaining ?? 0);
        setUnlimitedRewinds(body.unlimited ?? false);
      })
      .catch(() => {});
  };

  const purchaseUnlimitedRewinds = () => {
    fetch(`${API_URL}/api/rewinds/${encodeURIComponent(author)}/purchase-unlimited`, { method: "POST" })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (ok) loadRewindsRemaining();
        else setError(body.error ?? "Failed to purchase unlimited Rewinds");
      })
      .catch(() => setError("Failed to purchase unlimited Rewinds"));
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
      loadSuperLikeCredits();
      loadLikesRemaining();
      loadRewindsRemaining();
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
        <Link href="/double-date">Double Date</Link> &middot; <Link href="/live-events">Live Events</Link> &middot;{" "}
        <Link href="/message-requests">Message requests</Link> &middot; <Link href="/favorites">Favorites</Link>
      </p>
      <TotalMatchesBadge />
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
      <FacebookMutualConnections author={author} />
      <MusicMatches author={author} />
      <WeekendPlanMatches author={author} />
      <ZodiacMatches author={author} />
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
          <LottieAnimation src="/lottie/match-celebration.json" width={100} height={100} />
          🎉 It&apos;s a match with {matchNotice}!
        </div>
      )}
      {lastSwiped && (
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={undo}
            disabled={busy || (!unlimitedRewinds && rewindsRemaining <= 0)}
            title={unlimitedRewinds || rewindsRemaining > 0 ? "Rewind" : "No free Rewinds left today"}
          >
            ↺ Rewind
          </button>
          {!unlimitedRewinds && rewindsRemaining <= 0 && (
            <button onClick={purchaseUnlimitedRewinds} style={{ marginLeft: 8, fontSize: 12 }}>
              Get unlimited Rewinds (150 coins)
            </button>
          )}
        </div>
      )}
      {viewMode === "card" && (
        <VoiceSwipeControl
          onLike={() => swipe("like")}
          onPass={() => swipe("pass")}
          onSuperLike={() => swipe("superlike")}
          onUndo={undo}
        />
      )}
      {viewMode === "card" ? (
        current ? (
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 32, marginTop: 16 }}>
            <p style={{ fontSize: 20, fontWeight: "bold" }}>
              <Link href={`/profile/${encodeURIComponent(current.author)}`}>{current.author}</Link>
            </p>
            <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
              {current.compatibility}% match
              {current.distanceKm !== null && ` · ${current.distanceKm} km away`}
            </p>
            <WeatherBadge author={author} candidate={current.author} />
            <ProfileShareButton sharer={author} candidateAuthor={current.author} />
            <button
              onClick={() => toggleFavorite(current.author)}
              aria-pressed={favorites.has(current.author)}
              title={favorites.has(current.author) ? "Remove from favorites" : "Add to favorites"}
              style={{ marginTop: 4 }}
            >
              {favorites.has(current.author) ? "★ Favorited" : "☆ Favorite"}
            </button>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
              <button onClick={() => swipe("pass")} disabled={busy} style={{ fontSize: 24 }}>
                ✕
              </button>
              <button
                onClick={() => swipe("superlike")}
                disabled={busy || superLikesRemaining + superLikeCredits <= 0}
                style={{ fontSize: 24 }}
                title={superLikesRemaining + superLikeCredits > 0 ? "Super Like" : "No Super Likes left today"}
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
              {superLikesRemaining + superLikeCredits} Super Like{superLikesRemaining + superLikeCredits === 1 ? "" : "s"}
              {superLikeCredits > 0 && ` (${superLikeCredits} purchased)`} &middot; {likesRemaining} Like
              {likesRemaining === 1 ? "" : "s"} left today
            </p>
            {superLikesRemaining <= 0 && superLikePackages.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <span style={{ color: "var(--color-muted)" }}>Out of free Super Likes — buy more: </span>
                {superLikePackages.map((p) => (
                  <button key={p.id} onClick={() => purchaseSuperLikePackage(p.id)} style={{ marginLeft: 4 }}>
                    {p.superLikes} for {p.coinCost} coins
                  </button>
                ))}
              </div>
            )}
            <AdBanner author={author} />
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
                <p style={{ color: "var(--color-muted)", fontSize: 12, margin: 0 }}>
                  {candidate.compatibility}% match
                  {candidate.distanceKm !== null && ` · ${candidate.distanceKm} km away`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => toggleFavorite(candidate.author)}
                  aria-pressed={favorites.has(candidate.author)}
                  title={favorites.has(candidate.author) ? "Remove from favorites" : "Add to favorites"}
                >
                  {favorites.has(candidate.author) ? "★" : "☆"}
                </button>
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
