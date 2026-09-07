"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_DURATION_SECONDS = 30;

/** Picks a mime type the browser's MediaRecorder actually supports. */
function pickSupportedMimeType(): string {
  const candidates = ["audio/webm", "audio/ogg", "audio/mp4"];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "audio/webm";
}

export default function VoiceIntroRecorder({ author }: { author: string }) {
  const [hasClip, setHasClip] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clipKey, setClipKey] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/voice-intro/${encodeURIComponent(author)}`, { method: "HEAD" })
      .then((res) => setHasClip(res.ok))
      .catch(() => setHasClip(false));
  }, [author]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const upload = async (blob: Blob) => {
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const base64 = dataUrl.split(",")[1] ?? "";

      const res = await fetch(`${API_URL}/api/voice-intro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, mimeType: blob.type, data: base64 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to upload voice intro");
      }
      setHasClip(true);
      setClipKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload voice intro");
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        upload(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_DURATION_SECONDS) {
            stopRecording();
            setRecording(false);
          }
          return next;
        });
      }, 1000);
    } catch {
      setError("Couldn't access your microphone. Check your browser permissions.");
    }
  };

  const handleStopClick = () => {
    stopRecording();
    setRecording(false);
  };

  const remove = async () => {
    await fetch(`${API_URL}/api/voice-intro/${encodeURIComponent(author)}`, { method: "DELETE" });
    setHasClip(false);
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Voice intro</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Record a short voice intro (up to {MAX_DURATION_SECONDS} seconds) that plays on your profile.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!recording ? (
          <button onClick={startRecording} disabled={busy}>
            Record voice intro
          </button>
        ) : (
          <button onClick={handleStopClick}>Stop ({MAX_DURATION_SECONDS - seconds}s left)</button>
        )}
      </div>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {hasClip && (
        <div style={{ marginTop: 8 }}>
          <audio key={clipKey} src={`${API_URL}/api/voice-intro/${encodeURIComponent(author)}`} controls />
          <div>
            <button onClick={remove} style={{ marginTop: 4 }}>
              Remove voice intro
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
