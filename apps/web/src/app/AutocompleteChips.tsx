"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Automatic word prediction (Autocomplete) in chat" (#288)
 * — real prefix-based completions for the word currently being typed
 * (see wordPrediction.ts), not a fabricated AI-completion claim. Only
 * shown while the last word is at least 2 characters, same "don't
 * suggest on almost nothing" restraint #132's icebreakers only-early-on
 * gating uses for its own suggestion surface.
 */
export default function AutocompleteChips({ text, onComplete }: { text: string; onComplete: (nextText: string) => void }) {
  const [predictions, setPredictions] = useState<string[]>([]);
  const lastWord = text.slice(text.lastIndexOf(" ") + 1);

  useEffect(() => {
    if (lastWord.trim().length < 2) {
      setPredictions([]);
      return;
    }
    fetch(`${API_URL}/api/word-predictions?prefix=${encodeURIComponent(lastWord)}`)
      .then((res) => res.json())
      .then((body) => setPredictions(body.predictions ?? []))
      .catch(() => {});
  }, [lastWord]);

  if (predictions.length === 0) return null;

  const pick = (word: string) => {
    const beforeLastWord = text.slice(0, text.lastIndexOf(" ") + 1);
    onComplete(`${beforeLastWord}${word} `);
  };

  return (
    <div className="chat-app__icebreakers" aria-label="Word predictions">
      <div className="chat-app__icebreaker-list">
        {predictions.map((word) => (
          <button key={word} type="button" className="chat-app__icebreaker" onClick={() => pick(word)}>
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
