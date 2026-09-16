"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";
import { vibrateForeground, vibrationPatternForCategory } from "../notificationSound";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface LikedByEntry {
  author: string;
  compatibility: number;
}

/**
 * Tinder's real "Likes You" (#103), gated by #200's "Ability to see who
 * liked you as a paid feature": everyone who's already liked or
 * superliked this author but hasn't been swiped back on yet — now that
 * #191 provides a real premium tier, real Tinder's own "blurred grid +
 * count" pattern applies: a non-subscriber sees only the real count,
 * a subscriber sees the actual people. Liking or passing here uses the
 * same POST /api/swipes as /discover, so a mutual like immediately
 * creates a match.
 */
export default function LikedYouPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [likedBy, setLikedBy] = useState<LikedByEntry[]>([]);
  const [count, setCount] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_URL}/api/liked-you/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setLikedBy(body.likedBy ?? []);
        setCount(body.count ?? 0);
        setUnlocked(body.unlocked ?? false);
      })
      .catch(() => {});
  };

  useEffect(load, [author]);

  const swipe = async (candidate: string, direction: "like" | "pass") => {
    if (busy) return;
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
      setMatchNotice(body.matched ? candidate : null);
      // Bumble's real "Haptic feedback on like or Match" (#248) — same
      // navigator.vibrate patterns discover/page.tsx's main swipe uses.
      if (body.matched) {
        vibrateForeground(vibrationPatternForCategory("newMatch"));
      } else if (direction === "like") {
        vibrateForeground(vibrationPatternForCategory("newLike"));
      }
      setLikedBy((prev) => prev.filter((entry) => entry.author !== candidate));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to swipe");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>People who liked you</h1>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      {matchNotice && (
        <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          🎉 It&apos;s a match with {matchNotice}!
        </div>
      )}
      {!unlocked ? (
        count === 0 ? (
          <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No one yet — check back later.</p>
        ) : (
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 16, marginTop: 16, textAlign: "center" }}>
            <p style={{ fontSize: 20, fontWeight: "bold", filter: "blur(4px)" }}>
              {count} {count === 1 ? "person" : "people"} liked you
            </p>
            <p style={{ color: "var(--color-muted)", fontSize: 13 }}>Subscribe to see who they are.</p>
            <Link href="/pricing">
              <button style={{ marginTop: 8 }}>See who liked you</button>
            </Link>
          </div>
        )
      ) : likedBy.length === 0 ? (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No one yet — check back later.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {likedBy.map((entry) => (
            <li
              key={entry.author}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div>
                <p style={{ fontWeight: "bold" }}>
                  <Link href={`/profile/${encodeURIComponent(entry.author)}`}>{entry.author}</Link>
                </p>
                <p style={{ color: "var(--color-muted)", fontSize: 13 }}>{entry.compatibility}% match</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => swipe(entry.author, "pass")} disabled={busy}>
                  ✕
                </button>
                <button onClick={() => swipe(entry.author, "like")} disabled={busy}>
                  ♥
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </main>
  );
}
