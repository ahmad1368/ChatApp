"use client";

import { useEffect, useState } from "react";
import { formatMegabytes, getConnectionInfo, shouldWarnBeforeUpload } from "./mobileDataUploadWarning";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_DURATION_SECONDS = 30;
const MAX_BYTES = 20 * 1024 * 1024;

/** Reads a video file's duration without uploading it, using an off-DOM <video> element. */
function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Couldn't read that video file"));
    };
    video.src = URL.createObjectURL(file);
  });
}

export default function IntroVideoUpload({ author }: { author: string }) {
  const [hasVideo, setHasVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [videoKey, setVideoKey] = useState(0);
  const [pendingUpload, setPendingUpload] = useState<File | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/intro-video/${encodeURIComponent(author)}`, { method: "HEAD" })
      .then((res) => setHasVideo(res.ok))
      .catch(() => setHasVideo(false));
  }, [author]);

  const doUpload = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      if (file.size > MAX_BYTES) {
        throw new Error(`Video exceeds the ${MAX_BYTES / (1024 * 1024)}MB size limit`);
      }
      const duration = await readVideoDuration(file);
      if (duration > MAX_DURATION_SECONDS) {
        throw new Error(`Your intro video must be ${MAX_DURATION_SECONDS} seconds or shorter`);
      }

      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";

      const res = await fetch(`${API_URL}/api/intro-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, mimeType: file.type, data: base64 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to upload video");
      }
      setHasVideo(true);
      setVideoKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload video");
    } finally {
      setBusy(false);
    }
  };

  // Tinder's real "Alert for large video upload volume on mobile data"
  // (#310) — a large file on a detected cellular/Data Saver connection
  // pauses for confirmation instead of silently spending mobile data.
  const upload = (file: File) => {
    if (shouldWarnBeforeUpload(file.size, getConnectionInfo())) {
      setPendingUpload(file);
      return;
    }
    doUpload(file);
  };

  const remove = async () => {
    await fetch(`${API_URL}/api/intro-video/${encodeURIComponent(author)}`, { method: "DELETE" });
    setHasVideo(false);
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Intro video</h2>
      <p style={{ color: "var(--color-muted)" }}>
        A short looping video (up to {MAX_DURATION_SECONDS} seconds) that plays on your profile.
      </p>
      <input
        type="file"
        accept="video/mp4,video/webm"
        disabled={busy}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {pendingUpload && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 8, marginTop: 8 }}>
          <p style={{ margin: 0 }}>
            You&apos;re on mobile data — uploading this {formatMegabytes(pendingUpload.size)} video may use a lot of
            data. Upload anyway?
          </p>
          <div style={{ marginTop: 6 }}>
            <button
              onClick={() => {
                const file = pendingUpload;
                setPendingUpload(null);
                if (file) doUpload(file);
              }}
            >
              Upload anyway
            </button>
            <button onClick={() => setPendingUpload(null)} style={{ marginLeft: 6 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {hasVideo && (
        <div style={{ marginTop: 8 }}>
          <video
            key={videoKey}
            src={`${API_URL}/api/intro-video/${encodeURIComponent(author)}`}
            autoPlay
            loop
            muted
            playsInline
            style={{ maxWidth: "100%", borderRadius: 8 }}
          />
          <button onClick={remove} style={{ marginTop: 4 }}>
            Remove intro video
          </button>
        </div>
      )}
    </section>
  );
}
