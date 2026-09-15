"use client";

import { useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ConversationCompatibility {
  messageCountA: number;
  messageCountB: number;
  hasEnoughData: boolean;
  balanceScore: number;
  curiosityScore: number;
  topicOverlapScore: number;
  sharedKeywords: string[];
  avgMessageLengthA: number;
  avgMessageLengthB: number;
  compatibilityScore: number;
}

/**
 * OkCupid's real "Smart analysis of personality compatibility based on
 * conversations" (#233) — see conversationCompatibility.ts for the
 * honest scoping (real, explainable signals from the two people's
 * actual chat history).
 */
export default function ConversationCompatibilityPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [roomId, setRoomId] = useState("");
  const [otherAuthor, setOtherAuthor] = useState("");
  const [result, setResult] = useState<ConversationCompatibility | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setError(null);
    const res = await fetch(
      `${API_URL}/api/rooms/${encodeURIComponent(roomId)}/conversation-compatibility?authorA=${encodeURIComponent(
        author
      )}&authorB=${encodeURIComponent(otherAuthor)}`
    );
    if (!res.ok) {
      setError("Failed to analyze conversation");
      return;
    }
    setResult(await res.json());
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Conversation Compatibility</h1>
      <p style={{ color: "var(--color-muted)" }}>See how your actual conversation is going, based on real signals from your messages.</p>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room ID" style={{ width: "100%", marginBottom: 8 }} />
      <input
        value={otherAuthor}
        onChange={(e) => setOtherAuthor(e.target.value)}
        placeholder="The other person's name"
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button onClick={analyze} disabled={!roomId.trim() || !otherAuthor.trim()}>
        Analyze
      </button>

      {result && !result.hasEnoughData && (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>
          Not enough of a conversation yet ({result.messageCountA} vs {result.messageCountB} messages) — keep chatting and check back.
        </p>
      )}

      {result && result.hasEnoughData && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 16 }}>
          <p style={{ margin: 0 }}>
            Overall: <strong>{result.compatibilityScore}/100</strong>
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 13 }}>
            <li>Balance: {result.balanceScore}/100 — how evenly the conversation is shared</li>
            <li>Curiosity: {result.curiosityScore}/100 — how much you're both asking each other questions</li>
            <li>Topic overlap: {result.topicOverlapScore}/100 — how much you naturally talk about the same things</li>
          </ul>
          {result.sharedKeywords.length > 0 && (
            <p style={{ fontSize: 13 }}>
              Shared topics: <strong>{result.sharedKeywords.join(", ")}</strong>
            </p>
          )}
        </div>
      )}
    </main>
  );
}
