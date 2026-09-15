"use client";

import { useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface DateLocationSuggestion {
  category: { id: string; label: string; suggestion: string };
  matchingInterests: string[];
}

interface DateLocationResult {
  sharedInterests: string[];
  suggestions: DateLocationSuggestion[];
}

/**
 * Match.com's real "Suggest a suitable date location based on shared
 * interests" (#237) — see dateLocationSuggestions.ts for the honest
 * scoping (a real, deterministic mapping from the interest catalog to
 * date-location categories).
 */
export default function DateLocationSuggestionsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [otherAuthor, setOtherAuthor] = useState("");
  const [result, setResult] = useState<DateLocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getSuggestions = async () => {
    setError(null);
    const res = await fetch(
      `${API_URL}/api/date-location-suggestions?authorA=${encodeURIComponent(author)}&authorB=${encodeURIComponent(otherAuthor)}`
    );
    if (!res.ok) {
      setError("Failed to get suggestions");
      return;
    }
    setResult(await res.json());
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Date Location Ideas</h1>
      <p style={{ color: "var(--color-muted)" }}>Get date location ideas based on what you and a match both like.</p>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={otherAuthor}
          onChange={(e) => setOtherAuthor(e.target.value)}
          placeholder="The other person's name"
          style={{ flex: 1 }}
        />
        <button onClick={getSuggestions} disabled={!otherAuthor.trim()}>
          Suggest
        </button>
      </div>

      {result && result.sharedInterests.length === 0 && (
        <p style={{ color: "var(--color-muted)" }}>No shared interests listed yet — add some interests to your profile to get ideas.</p>
      )}

      {result && result.sharedInterests.length > 0 && (
        <>
          <p style={{ fontSize: 13 }}>
            Shared interests: <strong>{result.sharedInterests.join(", ")}</strong>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.suggestions.map((s) => (
              <div key={s.category.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontWeight: 700, margin: 0 }}>{s.category.label}</p>
                <p style={{ margin: "4px 0", fontSize: 13 }}>{s.category.suggestion}</p>
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>Based on: {s.matchingInterests.join(", ")}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
