"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Ability to define a favorites list" (#279) — the
 * standalone list view for the shortlist built up via the ☆ button on
 * discover/page.tsx. See favorites.ts for why this is scoped separately
 * from #138's pinned chats/#139's archived chats.
 */
export default function FavoritesPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/favorites/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setFavorites(body.favorites ?? []))
      .catch(() => {});
  }, [author]);

  const removeFavorite = (targetAuthor: string) => {
    setFavorites((prev) => prev.filter((a) => a !== targetAuthor));
    fetch(`${API_URL}/api/favorites`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewerAuthor: author, targetAuthor }),
    }).catch(() => {});
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Favorites</h1>
      <p style={{ color: "var(--color-muted)" }}>Profiles you&apos;ve saved for later.</p>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      {favorites.length === 0 ? (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No favorites yet — tap ☆ on a profile in Discover to save it here.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {favorites.map((favoriteAuthor) => (
            <li
              key={favoriteAuthor}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Link href={`/profile/${encodeURIComponent(favoriteAuthor)}`} style={{ fontWeight: "bold" }}>
                {favoriteAuthor}
              </Link>
              <button onClick={() => removeFavorite(favoriteAuthor)} title="Remove from favorites">
                ★ Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
