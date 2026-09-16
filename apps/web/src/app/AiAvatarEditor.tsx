"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Hinge's real "Ability to create a custom AI avatar based on the user's
 * photos" (#286) — POSTs an existing album photo id plus a chosen style to
 * the real Stability AI integration in aiAvatar.ts. This environment has
 * no STABILITY_API_KEY configured, so the 503 case is rendered as a
 * disclosed "not configured" state, same as GoogleSignInButton.tsx/
 * FacebookSignInButton.tsx/AppleSignInButton.tsx do for their own missing
 * credentials, rather than hiding the feature or fabricating a result.
 */
export default function AiAvatarEditor({ author }: { author: string }) {
  const [styles, setStyles] = useState<string[]>([]);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<{ style: string | null; createdAt: string | null }>({
    style: null,
    createdAt: null,
  });
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/ai-avatar/styles`)
      .then((res) => res.json())
      .then((body) => setStyles(body.styles ?? []))
      .catch(() => {});
    fetch(`${API_URL}/api/ai-avatar/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setAvatarStatus(body))
      .catch(() => {});
    fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/photos`)
      .then((res) => res.json())
      .then((body) => setPhotoIds(body.photoIds ?? []))
      .catch(() => {});
  }, [author]);

  const generate = async () => {
    if (!selectedPhotoId || !selectedStyle) return;
    setError(null);
    setNotConfigured(false);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/ai-avatar/${encodeURIComponent(author)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: selectedPhotoId, style: selectedStyle }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to generate AI avatar");
      }
      setAvatarStatus({ style: body.style, createdAt: body.createdAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate AI avatar");
    } finally {
      setBusy(false);
    }
  };

  if (photoIds.length === 0) {
    return null;
  }

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>AI avatar</h2>
      <p style={{ color: "var(--color-muted)", fontSize: 12 }}>Turn one of your photos into a stylized AI avatar.</p>

      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        {photoIds.map((id) => (
          <img
            key={id}
            src={`${API_URL}/api/photos/${id}?viewer=${encodeURIComponent(author)}`}
            alt="Album photo"
            onClick={() => setSelectedPhotoId(id)}
            style={{
              width: 56,
              height: 56,
              objectFit: "cover",
              borderRadius: 8,
              cursor: "pointer",
              border: selectedPhotoId === id ? "2px solid var(--color-fg, #000)" : "1px solid var(--color-border)",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {styles.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedStyle(s)}
            style={{
              fontSize: 12,
              border: selectedStyle === s ? "2px solid var(--color-fg, #000)" : "1px solid var(--color-border)",
              borderRadius: 6,
              padding: "4px 8px",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <button onClick={generate} disabled={busy || !selectedPhotoId || !selectedStyle} style={{ marginTop: 8 }}>
        Generate AI avatar
      </button>

      {avatarStatus.style && (
        <div style={{ marginTop: 8 }}>
          <img
            src={`${API_URL}/api/ai-avatar/${encodeURIComponent(author)}/image`}
            alt="AI avatar"
            style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }}
          />
          <p style={{ color: "var(--color-muted)", fontSize: 12 }}>Current style: {avatarStatus.style}</p>
        </div>
      )}
      {notConfigured && (
        <p style={{ color: "var(--color-muted)", fontSize: 12, marginTop: 8 }}>
          AI avatar generation is not configured for this deployment.
        </p>
      )}
      {error && <p style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </section>
  );
}
