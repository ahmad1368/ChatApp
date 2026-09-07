"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface LikedByEntry {
  author: string;
  compatibility: number;
}

/**
 * Tinder's real "Likes You" (#103): everyone who's already liked or
 * superliked this author but hasn't been swiped back on yet — real
 * Tinder blurs this behind a paywall; this app has no premium tier, so
 * it's shown in full, same scoping call as #92's free Rewind. Liking or
 * passing here uses the same POST /api/swipes as /discover, so a mutual
 * like immediately creates a match.
 */
export default function LikedYouPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [likedBy, setLikedBy] = useState<LikedByEntry[]>([]);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_URL}/api/liked-you/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setLikedBy(body.likedBy ?? []))
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
      {likedBy.length === 0 ? (
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
