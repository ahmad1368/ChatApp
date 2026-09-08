"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_ROOM_ID } from "@chatapp/shared";
import { getOrCreateGuestIdentity } from "../guestIdentity";
import MatchCountdown from "../MatchCountdown";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Match {
  author: string;
  compatibility: number;
}

/**
 * OkCupid's mutual compatibility percentage (#100), shown persistently
 * once matched rather than only during swiping — #94's "% match" badge on
 * /discover's swipe card is transient (gone once you swipe past a
 * candidate). Reuses the same computeInterestCompatibility score, now
 * computed for GET /api/matches/:author instead.
 *
 * Links into the app's single shared chat room (#1-28's original chat
 * core, still one room per this app's current scope) rather than a
 * per-match private thread — matched-pair DM rooms don't exist yet in
 * this codebase and are a separate, larger feature. Each row also shows
 * #136's real 24-hour "say something before the match expires" countdown
 * (see MatchCountdown.tsx) — an expired match with nobody having sent a
 * first message just drops out of this list entirely on the next load.
 */
export default function MatchesPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/matches/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMatches(body.matches ?? []))
      .catch(() => {});
  }, [author]);

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Your matches</h1>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      {matches.length === 0 ? (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No matches yet — keep swiping!</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {matches.map((match) => (
            <li
              key={match.author}
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
                  <Link href={`/profile/${encodeURIComponent(match.author)}`}>{match.author}</Link>
                </p>
                <p style={{ color: "var(--color-muted)", fontSize: 13 }}>{match.compatibility}% compatible</p>
                <MatchCountdown author={author} candidate={match.author} />
              </div>
              <Link href={`/room/${DEFAULT_ROOM_ID}`}>Chat</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
