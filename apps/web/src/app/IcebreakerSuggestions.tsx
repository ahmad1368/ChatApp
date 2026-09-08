"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Hinge's real "AI-suggested conversation starters" (#132) — genuinely
 * personalized from real shared-signal data (see icebreakers.ts), not an
 * invented LLM call. Shown only early in a conversation (few messages so
 * far), same as when Hinge actually surfaces these — a starter isn't
 * useful once you're already talking.
 */
export default function IcebreakerSuggestions({
  author,
  candidate,
  onPick,
}: {
  author: string;
  candidate: string;
  onPick: (suggestion: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/icebreakers/${encodeURIComponent(author)}/${encodeURIComponent(candidate)}`)
      .then((res) => res.json())
      .then((body) => setSuggestions(body.suggestions ?? []))
      .catch(() => {});
  }, [author, candidate]);

  if (suggestions.length === 0) return null;

  return (
    <div className="chat-app__icebreakers">
      <p className="chat-app__icebreakers-label">💬 Conversation starters</p>
      <div className="chat-app__icebreaker-list">
        {suggestions.map((suggestion, i) => (
          <button key={i} className="chat-app__icebreaker" onClick={() => onPick(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
