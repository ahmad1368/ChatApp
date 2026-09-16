"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";
import { vibrateForeground, vibrationPatternForCategory } from "../notificationSound";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface RejectedEntry {
  author: string;
  compatibility: number;
}

/**
 * Tinder's real "Ability to return to yesterday's rejected likes" (#297)
 * — every profile passed on the previous calendar day, distinct from
 * #92's Rewind (undoes only the single most recent swipe). Deciding here
 * first reconsiders the pass (clearing it server-side) and then records
 * a fresh swipe via the same POST /api/swipes /discover uses, so a
 * mutual like immediately creates a match.
 */
export default function YesterdaysRejectedLikesPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [entries, setEntries] = useState<RejectedEntry[]>([]);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_URL}/api/yesterdays-rejected-likes/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setEntries(body.candidates ?? []))
      .catch(() => {});
  };

  useEffect(load, [author]);

  const decide = async (candidate: string, direction: "like" | "pass") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const reconsiderRes = await fetch(
        `${API_URL}/api/yesterdays-rejected-likes/${encodeURIComponent(author)}/${encodeURIComponent(candidate)}/reconsider`,
        { method: "POST" }
      );
      if (!reconsiderRes.ok) {
        const body = await reconsiderRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to reconsider");
      }

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
      if (body.matched) {
        vibrateForeground(vibrationPatternForCategory("newMatch"));
      } else if (direction === "like") {
        vibrateForeground(vibrationPatternForCategory("newLike"));
      }
      setEntries((prev) => prev.filter((entry) => entry.author !== candidate));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to swipe");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Yesterday&apos;s rejected likes</h1>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      {matchNotice && (
        <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          🎉 It&apos;s a match with {matchNotice}!
        </div>
      )}
      {entries.length === 0 ? (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>Nothing to revisit from yesterday.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {entries.map((entry) => (
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
                <button onClick={() => decide(entry.author, "pass")} disabled={busy}>
                  ✕
                </button>
                <button onClick={() => decide(entry.author, "like")} disabled={busy}>
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
