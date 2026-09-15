"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const REASON_LABEL: Record<string, string> = {
  impossibly_fast_replies: "Replies too fast for a human to have typed them",
  uniform_timing: "Suspiciously uniform, scripted-looking send timing",
  duplicate_broadcast_text: "Same message broadcast verbatim to several people",
};

interface TypingPatternAnalysis {
  messageCount: number;
  hasEnoughData: boolean;
  flagged: boolean;
  reasons: string[];
}

/**
 * Hinge's real "High-accuracy bot account detection based on typing
 * patterns" (#236) — see typingPatternDetector.ts for the honest scoping
 * (real message-timing and duplicate-text signals, not a fabricated
 * keystroke-level ML model).
 */
export default function AdminBotDetectionPage() {
  const [adminKey, setAdminKey] = useState("");
  const [author, setAuthor] = useState("");
  const [result, setResult] = useState<TypingPatternAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/typing-pattern/${encodeURIComponent(author)}`, {
      headers: { "x-admin-key": adminKey },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to analyze");
      return;
    }
    setResult(body);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Bot detection</h1>
      <p style={{ color: "var(--color-muted)" }}>Analyze one author's real send-timing and message-content patterns for bot-like behavior.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          analyze();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}
      >
        <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Admin key" style={{ padding: 8 }} />
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author to analyze" style={{ padding: 8 }} />
        <button type="submit" disabled={!adminKey || !author}>
          Analyze
        </button>
      </form>

      {error && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}

      {result && !result.hasEnoughData && (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>Only {result.messageCount} messages — not enough to analyze yet.</p>
      )}

      {result && result.hasEnoughData && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, color: result.flagged ? "var(--color-danger)" : "var(--color-success, green)" }}>
            {result.flagged ? "Flagged as bot-like" : "No bot-like patterns detected"}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>{result.messageCount} messages analyzed</p>
          {result.reasons.length > 0 && (
            <ul style={{ paddingLeft: 20 }}>
              {result.reasons.map((reason) => (
                <li key={reason}>{REASON_LABEL[reason] ?? reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
