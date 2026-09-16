"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * Hinge's real "Ability to add background music to the profile" (#251) —
 * uploads an actual audio file (an existing song clip the profile owner
 * already has), unlike #64's VoiceIntroRecorder which records fresh from
 * the mic; this app has no licensed streaming catalog to pull real songs
 * from, so this is honestly scoped to a clip the user supplies themselves.
 */
export default function BackgroundMusicUploader({ author }: { author: string }) {
  const [hasTrack, setHasTrack] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trackKey, setTrackKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/background-music/${encodeURIComponent(author)}`, { method: "HEAD" })
      .then((res) => setHasTrack(res.ok))
      .catch(() => setHasTrack(false));
  }, [author]);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("audio/")) {
      setError("Please choose an audio file");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB size limit`);
      return;
    }

    setBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";

      const res = await fetch(`${API_URL}/api/background-music`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, mimeType: file.type, data: base64, title: title.trim() || file.name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to upload background music");
      }
      setHasTrack(true);
      setTrackKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload background music");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const remove = async () => {
    await fetch(`${API_URL}/api/background-music/${encodeURIComponent(author)}`, { method: "DELETE" });
    setHasTrack(false);
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Background music</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Add a short music clip (up to {MAX_FILE_BYTES / (1024 * 1024)}MB) that plays on your profile.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Track title (optional)"
          style={{ flex: 1, minWidth: 160 }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          disabled={busy}
        />
      </div>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {hasTrack && (
        <div style={{ marginTop: 8 }}>
          <audio key={trackKey} src={`${API_URL}/api/background-music/${encodeURIComponent(author)}`} controls />
          <div>
            <button onClick={remove} style={{ marginTop: 4 }}>
              Remove background music
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
