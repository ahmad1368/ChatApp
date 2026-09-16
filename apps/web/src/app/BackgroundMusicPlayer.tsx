"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Read-only counterpart to BackgroundMusicUploader.tsx (#251) — shown on
 * someone else's profile. A HEAD request alone (no audio bytes
 * downloaded) tells us whether a track exists and its title via the
 * X-Track-Title header set in server.ts's GET route. Browsers block
 * unmuted autoplay without a user gesture, so this is honestly a real
 * play button rather than a fabricated "plays automatically" claim.
 */
export default function BackgroundMusicPlayer({ author }: { author: string }) {
  const [title, setTitle] = useState<string | null>(null);
  const [hasTrack, setHasTrack] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/background-music/${encodeURIComponent(author)}`, { method: "HEAD" })
      .then((res) => {
        setHasTrack(res.ok);
        if (res.ok) {
          const rawTitle = res.headers.get("X-Track-Title");
          setTitle(rawTitle ? decodeURIComponent(rawTitle) : null);
        }
      })
      .catch(() => setHasTrack(false));
  }, [author]);

  if (!hasTrack) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 4 }}>
        🎵 {title || "Background music"}
      </p>
      <audio src={`${API_URL}/api/background-music/${encodeURIComponent(author)}`} controls />
    </div>
  );
}
