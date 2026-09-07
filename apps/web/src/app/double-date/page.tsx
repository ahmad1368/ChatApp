"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Squad {
  id: string;
  members: string[];
}

interface GroupMatch {
  squadId: string;
  roomId: string;
}

/**
 * Match.com/Tinder's real "Double Date" (#109): team up with 1-3 friends
 * as one squad, then swipe on other squads together — a mutual like
 * opens one shared group chat room for everyone in both squads. See
 * squads.ts for the group-matching mechanic.
 */
export default function DoubleDatePage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [squad, setSquad] = useState<Squad | null>(null);
  const [friendNames, setFriendNames] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [matches, setMatches] = useState<GroupMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchNotice, setMatchNotice] = useState<GroupMatch | null>(null);

  const loadSquad = () => {
    fetch(`${API_URL}/api/squads/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setSquad(body.squad ?? null))
      .catch(() => {});
  };

  useEffect(loadSquad, [author]);

  const loadCandidates = (squadId: string) => {
    fetch(`${API_URL}/api/squad-candidates/${squadId}`)
      .then((res) => res.json())
      .then((body) => setCandidates(body.candidates ?? []))
      .catch(() => {});
  };

  const loadMatches = (squadId: string) => {
    fetch(`${API_URL}/api/squad-matches/${squadId}`)
      .then((res) => res.json())
      .then((body) => setMatches(body.matches ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    if (!squad) return;
    fetch(`${API_URL}/api/squads/${squad.id}/discovery`, { method: "POST" }).then(() => loadCandidates(squad.id));
    loadMatches(squad.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squad?.id]);

  const createSquad = async () => {
    setError(null);
    setBusy(true);
    try {
      const members = [author, ...friendNames.split(",").map((n) => n.trim()).filter(Boolean)];
      const res = await fetch(`${API_URL}/api/squads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to create squad");
      }
      setSquad(body.squad);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create squad");
    } finally {
      setBusy(false);
    }
  };

  const disbandSquad = async () => {
    if (!squad) return;
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/squads/${squad.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author }),
      });
      setSquad(null);
      setCandidates([]);
      setMatches([]);
    } finally {
      setBusy(false);
    }
  };

  const swipe = async (candidateSquadId: string, direction: "like" | "pass") => {
    if (!squad || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/squad-swipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swiperSquadId: squad.id, swipedSquadId: candidateSquadId, direction }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to swipe");
      }
      if (body.matched) {
        const match = { squadId: candidateSquadId, roomId: body.roomId };
        setMatchNotice(match);
        setMatches((prev) => [...prev, match]);
      }
      setCandidates((prev) => prev.filter((id) => id !== candidateSquadId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to swipe");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Double Date</h1>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>

      {!squad ? (
        <section>
          <p style={{ color: "var(--color-muted)" }}>Team up with 1-3 friends and swipe on other squads together.</p>
          <input
            value={friendNames}
            onChange={(e) => setFriendNames(e.target.value)}
            placeholder="Friend names, comma-separated"
            style={{ width: "100%", marginTop: 8 }}
          />
          <button onClick={createSquad} disabled={busy || !friendNames.trim()} style={{ marginTop: 8 }}>
            Create squad
          </button>
        </section>
      ) : (
        <>
          <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12 }}>
            <p>
              Your squad: <strong>{squad.members.join(", ")}</strong>
            </p>
            <button onClick={disbandSquad} disabled={busy}>
              Disband squad
            </button>
          </section>

          {matchNotice && (
            <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, marginTop: 12 }}>
              🎉 Group match! <Link href={`/room/${matchNotice.roomId}`}>Open the group chat</Link>
            </div>
          )}

          <section style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 14 }}>Other squads</h2>
            {candidates.length === 0 ? (
              <p style={{ color: "var(--color-muted)" }}>No other squads right now — check back later.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {candidates.map((candidateId) => (
                  <li
                    key={candidateId}
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
                    <span>Squad {candidateId.slice(0, 8)}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => swipe(candidateId, "pass")} disabled={busy}>
                        ✕
                      </button>
                      <button onClick={() => swipe(candidateId, "like")} disabled={busy}>
                        ♥
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {matches.length > 0 && (
            <section style={{ marginTop: 16 }}>
              <h2 style={{ fontSize: 14 }}>Group matches</h2>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {matches.map((match) => (
                  <li key={match.squadId} style={{ marginBottom: 8 }}>
                    <Link href={`/room/${match.roomId}`}>Open group chat</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </main>
  );
}
