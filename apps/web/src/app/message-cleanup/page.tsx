"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const REASON_LABEL: Record<string, string> = {
  profanity: "Profanity masked",
  spam_phrase: "Spam/promo phrasing removed",
  url: "Link removed",
};

interface CleanMessageResult {
  cleaned: string;
  wasModified: boolean;
  removedReasons: string[];
}

/**
 * OkCupid's real "Smart filter to remove offensive or spam text before
 * sending" (#240) — see messageCleanupFilter.ts for the honest scoping
 * (an actual pre-send text transformation, distinct from #143's
 * interactive warning and spamDetector.ts's silent post-send flag).
 */
export default function MessageCleanupPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<CleanMessageResult | null>(null);

  const clean = async () => {
    const res = await fetch(`${API_URL}/api/messages/clean-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setResult(await res.json());
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Clean Up My Message</h1>
      <p style={{ color: "var(--color-muted)" }}>Preview a cleaned-up version of your message before you send it.</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Draft your message here..."
        style={{ width: "100%", minHeight: 100, marginBottom: 8 }}
      />
      <button onClick={clean} disabled={!text.trim()}>
        Clean Up
      </button>

      {result && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 16 }}>
          {result.wasModified ? (
            <>
              <p style={{ fontWeight: 700, margin: 0 }}>Cleaned version:</p>
              <p style={{ whiteSpace: "pre-wrap" }}>{result.cleaned}</p>
              <ul style={{ paddingLeft: 20, fontSize: 13, color: "var(--color-muted)" }}>
                {[...new Set(result.removedReasons)].map((reason) => (
                  <li key={reason}>{REASON_LABEL[reason] ?? reason}</li>
                ))}
              </ul>
            </>
          ) : (
            <p style={{ color: "var(--color-muted)", margin: 0 }}>Nothing to clean up — this message looks fine as-is.</p>
          )}
        </div>
      )}
    </main>
  );
}
