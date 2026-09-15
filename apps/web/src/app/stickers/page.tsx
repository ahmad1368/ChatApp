"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STYLE_LABEL: Record<string, string> = {
  cartoon: "Cartoon",
  sketch: "Sketch",
  popart: "Pop Art",
  vintage: "Vintage",
  pixel: "Pixel",
};

interface StickerSummary {
  id: string;
  style: string;
  createdAt: string;
}

/**
 * Hinge's real "Generate custom chat stickers based on the user's face
 * using AI" (#239) — see stickerGenerator.ts for the honest scoping (a
 * real Jimp filter pipeline over your own uploaded photo, not a
 * fabricated face-generation model).
 */
export default function StickersPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [style, setStyle] = useState("cartoon");
  const [stickers, setStickers] = useState<StickerSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStickers = () => {
    fetch(`${API_URL}/api/stickers/author/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setStickers(body.stickers ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/photos`)
      .then((res) => res.json())
      .then((body) => setPhotoIds(body.photoIds ?? []))
      .catch(() => {});
    fetch(`${API_URL}/api/sticker-styles`)
      .then((res) => res.json())
      .then((body) => setStyles(body.styles ?? []))
      .catch(() => {});
    loadStickers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  const generate = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/stickers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, photoId: selectedPhotoId, style }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to generate sticker");
        return;
      }
      loadStickers();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Chat Stickers</h1>
      <p style={{ color: "var(--color-muted)" }}>Turn one of your photos into a sticker to send in chat.</p>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {photoIds.length === 0 && <p style={{ color: "var(--color-muted)" }}>Upload a photo to your album first to make a sticker.</p>}

      {photoIds.length > 0 && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <select value={selectedPhotoId} onChange={(e) => setSelectedPhotoId(e.target.value)} style={{ width: "100%", marginBottom: 8 }}>
            <option value="">Choose a photo</option>
            {photoIds.map((id) => (
              <option key={id} value={id}>
                Photo {id}
              </option>
            ))}
          </select>
          <select value={style} onChange={(e) => setStyle(e.target.value)} style={{ width: "100%", marginBottom: 8 }}>
            {styles.map((s) => (
              <option key={s} value={s}>
                {STYLE_LABEL[s] ?? s}
              </option>
            ))}
          </select>
          <button onClick={generate} disabled={busy || !selectedPhotoId}>
            {busy ? "Generating..." : "Generate Sticker"}
          </button>
        </div>
      )}

      <h2 style={{ fontSize: 16 }}>Your sticker pack</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 12 }}>
        {stickers.map((sticker) => (
          <div key={sticker.id} style={{ textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API_URL}/api/stickers/${sticker.id}`}
              alt={`${STYLE_LABEL[sticker.style] ?? sticker.style} sticker`}
              style={{ width: 96, height: 96, borderRadius: 8 }}
            />
            <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "4px 0 0" }}>{STYLE_LABEL[sticker.style] ?? sticker.style}</p>
          </div>
        ))}
        {stickers.length === 0 && <p style={{ color: "var(--color-muted)" }}>No stickers yet.</p>}
      </div>
    </main>
  );
}
