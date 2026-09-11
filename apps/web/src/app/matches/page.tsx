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
  archived: boolean;
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
 * #138's pin toggle sorts pinned matches to the top of this list, per
 * viewer (see pinnedChats.ts — one-sided, like #45's blocking). #139's
 * archive toggle hides a match from the default list without unmatching
 * or affecting #136/#137's expiry timer, and can be reviewed in a
 * separate "Show archived" view (see archivedChats.ts — also one-sided).
 */
export default function MatchesPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [matches, setMatches] = useState<Match[]>([]);
  const [pinnedChats, setPinnedChats] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const loadMatches = () => {
    fetch(`${API_URL}/api/matches/${encodeURIComponent(author)}?includeArchived=true`)
      .then((res) => res.json())
      .then((body) => setMatches(body.matches ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    loadMatches();

    fetch(`${API_URL}/api/pinned-chats/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setPinnedChats(new Set(body.pinnedChats ?? [])))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  const toggleArchive = (chatAuthor: string, isArchived: boolean) => {
    const method = isArchived ? "DELETE" : "POST";
    fetch(`${API_URL}/api/archived-chats`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewerAuthor: author, chatAuthor }),
    })
      .then((res) => {
        if (!res.ok) return;
        setMatches((prev) =>
          prev.map((m) => (m.author === chatAuthor ? { ...m, archived: !isArchived } : m))
        );
      })
      .catch(() => {});
  };

  const unmatch = (chatAuthor: string) => {
    if (!window.confirm(`Unmatch ${chatAuthor} and delete this chat? This can't be undone.`)) return;
    fetch(`${API_URL}/api/matches/${encodeURIComponent(author)}/${encodeURIComponent(chatAuthor)}`, {
      method: "DELETE",
    })
      .then((res) => {
        if (!res.ok) return;
        setMatches((prev) => prev.filter((m) => m.author !== chatAuthor));
        setPinnedChats((prev) => {
          if (!prev.has(chatAuthor)) return prev;
          const next = new Set(prev);
          next.delete(chatAuthor);
          return next;
        });
      })
      .catch(() => {});
  };

  const togglePin = (chatAuthor: string) => {
    const isPinned = pinnedChats.has(chatAuthor);
    const method = isPinned ? "DELETE" : "POST";
    fetch(`${API_URL}/api/pinned-chats`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewerAuthor: author, chatAuthor }),
    })
      .then((res) => {
        if (!res.ok) return;
        setPinnedChats((prev) => {
          const next = new Set(prev);
          if (isPinned) next.delete(chatAuthor);
          else next.add(chatAuthor);
          return next;
        });
      })
      .catch(() => {});
  };

  const visibleMatches = matches.filter((m) => m.archived === showArchived);
  const sortedMatches = [...visibleMatches].sort((a, b) => {
    const aPinned = pinnedChats.has(a.author) ? 1 : 0;
    const bPinned = pinnedChats.has(b.author) ? 1 : 0;
    return bPinned - aPinned;
  });
  const archivedCount = matches.filter((m) => m.archived).length;

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Your matches</h1>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((prev) => !prev)}
          style={{
            fontSize: 12,
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            padding: "4px 8px",
            cursor: "pointer",
            marginBottom: 8,
          }}
        >
          {showArchived ? "← Back to matches" : `Show archived (${archivedCount})`}
        </button>
      )}
      {sortedMatches.length === 0 ? (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>
          {showArchived ? "No archived chats." : "No matches yet — keep swiping!"}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {sortedMatches.map((match) => (
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
                background: pinnedChats.has(match.author) ? "var(--color-surface-raised, rgba(0,0,0,0.03))" : undefined,
              }}
            >
              <div>
                <p style={{ fontWeight: "bold" }}>
                  {pinnedChats.has(match.author) && "📌 "}
                  <Link href={`/profile/${encodeURIComponent(match.author)}`}>{match.author}</Link>
                </p>
                <p style={{ color: "var(--color-muted)", fontSize: 13 }}>{match.compatibility}% compatible</p>
                <MatchCountdown author={author} candidate={match.author} />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => togglePin(match.author)}
                  style={{
                    fontSize: 12,
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  {pinnedChats.has(match.author) ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleArchive(match.author, match.archived)}
                  style={{
                    fontSize: 12,
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  {match.archived ? "Unarchive" : "Archive"}
                </button>
                <Link href={`/room/${DEFAULT_ROOM_ID}`}>Chat</Link>
                <button
                  type="button"
                  onClick={() => unmatch(match.author)}
                  style={{
                    fontSize: 12,
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                    color: "var(--color-danger, #c0392b)",
                  }}
                >
                  Unmatch
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
