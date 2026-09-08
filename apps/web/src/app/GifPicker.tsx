"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface GiphyResult {
  id: string;
  url: string;
  previewUrl: string;
  title: string;
}

/**
 * Tinder's real "send a GIF/sticker" (#124) via an actual Giphy
 * integration — see giphy.ts. Picking a result sends it immediately as a
 * regular chat image message (no separate confirm step, matching a quick
 * GIF-reaction UX) and closes the picker.
 */
export default function GifPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"gifs" | "stickers">("gifs");
  const [results, setResults] = useState<GiphyResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/giphy/search?q=${encodeURIComponent(query)}&type=${type}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Search failed");
      }
      setResults(body.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-app__gif-picker">
      <div className="chat-app__gif-picker-header">
        <select value={type} onChange={(e) => setType(e.target.value as "gifs" | "stickers")}>
          <option value="gifs">GIFs</option>
          <option value="stickers">Stickers</option>
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
          }}
          placeholder={`Search ${type}`}
          className="chat-app__input"
        />
        <button onClick={search} disabled={busy || !query.trim()}>
          Search
        </button>
        <button onClick={onClose}>✕</button>
      </div>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="chat-app__gif-results">
        {results.map((result) => (
          <button
            key={result.id}
            className="chat-app__gif-result"
            onClick={() => onPick(result.url)}
            title={result.title}
          >
            <img src={result.previewUrl} alt={result.title} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
