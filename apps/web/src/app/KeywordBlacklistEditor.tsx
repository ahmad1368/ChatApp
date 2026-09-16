"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Ability to define a blacklist of disliked keywords"
 * (#322) — see keywordBlacklist.ts. A candidate whose bio mentions any of
 * these words never reaches this author's discovery deck.
 */
export default function KeywordBlacklistEditor({ author }: { author: string }) {
  const [keywordsText, setKeywordsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/keyword-blacklist/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setKeywordsText((body.keywords ?? []).join(", ")))
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const keywords = keywordsText
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch(`${API_URL}/api/keyword-blacklist/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save blacklisted keywords");
      setKeywordsText((body.keywords ?? []).join(", "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save blacklisted keywords");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Blacklisted keywords</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Candidates whose bio mentions any of these words won&apos;t appear in your discovery deck.
      </p>
      <input
        type="text"
        value={keywordsText}
        onChange={(e) => setKeywordsText(e.target.value)}
        placeholder="e.g. smoking, crypto"
        style={{ width: "100%", marginTop: 4 }}
      />
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
