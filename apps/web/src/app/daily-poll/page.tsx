"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PollOption {
  id: string;
  text: string;
}

interface PollResultOption extends PollOption {
  votes: number;
  percentage: number;
}

interface PollStatus {
  poll: { id: string; question: string; options: PollOption[] };
  myVote: string | null;
  results: PollResultOption[];
  totalVotes: number;
}

/**
 * OkCupid's real "Daily polls focused on relationships and personality"
 * (#214) — see dailyPolls.ts for the honest scoping (one shared question
 * per UTC day, with a real aggregate percentage breakdown shown once the
 * viewer has voted).
 */
export default function DailyPollPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [status, setStatus] = useState<PollStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_URL}/api/daily-poll/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => {});
  };

  useEffect(load, [author]);

  const vote = async (optionId: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/daily-poll/${encodeURIComponent(author)}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to vote");
      return;
    }
    setStatus(body);
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Daily Poll</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {status && (
        <>
          <p style={{ fontSize: 18, fontWeight: 700 }}>{status.poll.question}</p>

          {status.myVote === null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {status.poll.options.map((option) => (
                <button key={option.id} onClick={() => vote(option.id)} style={{ textAlign: "left", padding: 10 }}>
                  {option.text}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {status.results.map((option) => (
                <div key={option.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: option.id === status.myVote ? 700 : 400 }}>
                      {option.text} {option.id === status.myVote && "(your answer)"}
                    </span>
                    <span>{option.percentage}%</span>
                  </div>
                  <div style={{ background: "var(--color-border)", borderRadius: 4, height: 6, marginTop: 6 }}>
                    <div style={{ background: "var(--color-accent, #6d5ef8)", width: `${option.percentage}%`, height: 6, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              <p style={{ color: "var(--color-muted)", fontSize: 13 }}>{status.totalVotes} people answered today</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
