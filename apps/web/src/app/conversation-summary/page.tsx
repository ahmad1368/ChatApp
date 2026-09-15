"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface HighlightMessage {
  author: string;
  text: string;
  createdAt: string;
}

interface ConversationSummary {
  messageCount: number;
  hasEnoughData: boolean;
  dateRange: { first: string; last: string } | null;
  topKeywords: string[];
  highlights: HighlightMessage[];
}

/**
 * Hinge's real "Smart summarizer for long conversations" (#235) — see
 * conversationSummarizer.ts for the honest scoping (a real extractive
 * summary, not a fabricated abstractive LLM summary).
 */
export default function ConversationSummaryPage() {
  const [roomId, setRoomId] = useState("");
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summarize = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}/conversation-summary`);
    if (!res.ok) {
      setError("Failed to summarize conversation");
      return;
    }
    setSummary(await res.json());
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Conversation Summary</h1>
      <p style={{ color: "var(--color-muted)" }}>Get a quick recap of a long conversation — top topics and the moments worth remembering.</p>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room ID" style={{ flex: 1 }} />
        <button onClick={summarize} disabled={!roomId.trim()}>
          Summarize
        </button>
      </div>

      {summary && !summary.hasEnoughData && (
        <p style={{ color: "var(--color-muted)" }}>This conversation ({summary.messageCount} messages) is too short to summarize yet.</p>
      )}

      {summary && summary.hasEnoughData && (
        <>
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>
            {summary.messageCount} messages
            {summary.dateRange && (
              <>
                {" "}
                &middot; {new Date(summary.dateRange.first).toLocaleDateString()} &ndash;{" "}
                {new Date(summary.dateRange.last).toLocaleDateString()}
              </>
            )}
          </p>

          {summary.topKeywords.length > 0 && (
            <p>
              <strong>What you&apos;ve talked about: </strong>
              {summary.topKeywords.join(", ")}
            </p>
          )}

          <h2 style={{ fontSize: 16 }}>Highlights</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {summary.highlights.map((h, i) => (
              <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{h.author}</p>
                <p style={{ margin: "4px 0 0" }}>{h.text}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
