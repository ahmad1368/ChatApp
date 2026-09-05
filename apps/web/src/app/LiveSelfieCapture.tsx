"use client";

import { useEffect, useRef, useState } from "react";
import { detectFace } from "./faceDetection";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const CAPTURE_SIZE = 320;

interface Props {
  userId: string;
  onDone: (verified: boolean) => void;
}

/**
 * Captures a frame from a live camera feed (never a picked file — the only
 * anti-spoofing measure implemented here is "you must present a live
 * camera", not full liveness/anti-replay detection, which would need a
 * dedicated ID-verification vendor. See verification.ts for the full note.
 */
export default function LiveSelfieCapture({ userId, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"requesting" | "ready" | "unavailable">("requesting");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: CAPTURE_SIZE, height: CAPTURE_SIZE } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus("ready");
      })
      .catch(() => setStatus("unavailable"));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setIsSubmitting(true);

    const canvas = document.createElement("canvas");
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

    const frame = new Image();
    frame.src = canvas.toDataURL("image/jpeg");
    await new Promise((resolve) => (frame.onload = resolve));
    const faceFound = await detectFace(frame);

    if (faceFound === false) {
      setError("We couldn't find a face in that frame — make sure your face is centered and try again.");
      setIsSubmitting(false);
      return;
    }

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Capture failed"))), "image/jpeg", 0.85)
    );
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    try {
      const res = await fetch(`${API_URL}/api/verification/selfie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mimeType: "image/jpeg", data: base64 }),
      });
      if (!res.ok) throw new Error("Verification failed");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>Verify it's really you</label>
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 0, marginBottom: 12 }}>
        Take a live selfie — this photo is used only to confirm your identity and is never shown on your profile.
      </p>

      {status === "unavailable" && (
        <p style={{ fontSize: 13, color: "#6b7280" }}>Camera unavailable. You can skip this for now.</p>
      )}
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}

      {status !== "unavailable" && (
        <div
          style={{
            width: CAPTURE_SIZE,
            height: CAPTURE_SIZE,
            borderRadius: "50%",
            overflow: "hidden",
            margin: "0 auto 16px",
            background: "#111827",
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => onDone(false)} style={{ flex: 1, padding: 10 }}>
          Skip for now
        </button>
        {status === "ready" && (
          <button type="button" onClick={capture} disabled={isSubmitting} style={{ flex: 1, padding: 10 }}>
            {isSubmitting ? "Verifying…" : "Capture"}
          </button>
        )}
      </div>
    </div>
  );
}
