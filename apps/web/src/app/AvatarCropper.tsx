"use client";

import { useRef, useState } from "react";

const VIEWPORT_SIZE = 260; // on-screen crop circle, in px
const OUTPUT_SIZE = 400; // exported image dimensions
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const JPEG_QUALITY = 0.85;

interface Props {
  file: File;
  onCancel: () => void;
  onCropped: (result: { mimeType: string; base64: string }) => void;
}

/** Minimal drag-to-pan + zoom cropper: no library, just pointer events and a
 * canvas render at confirm time. Good enough for a circular profile photo
 * crop without pulling in a full cropping dependency. */
export default function AvatarCropper({ file, onCancel, onCropped }: Props) {
  const [imageUrl] = useState(() => URL.createObjectURL(file));
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setOffset({
      x: dragStart.current.offsetX + (e.clientX - dragStart.current.x),
      y: dragStart.current.offsetY + (e.clientY - dragStart.current.y),
    });
  };

  const endDrag = () => {
    dragStart.current = null;
  };

  const confirmCrop = async () => {
    const img = imgRef.current;
    if (!img) return;
    setIsSaving(true);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d")!;

    // Circular clip so the exported image matches the round on-screen preview.
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const scaleToViewport = OUTPUT_SIZE / VIEWPORT_SIZE;
    const baseScale = Math.max(VIEWPORT_SIZE / img.naturalWidth, VIEWPORT_SIZE / img.naturalHeight) * zoom;
    const drawWidth = img.naturalWidth * baseScale * scaleToViewport;
    const drawHeight = img.naturalHeight * baseScale * scaleToViewport;
    const drawX = OUTPUT_SIZE / 2 - drawWidth / 2 + offset.x * scaleToViewport;
    const drawY = OUTPUT_SIZE / 2 - drawHeight / 2 + offset.y * scaleToViewport;
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/jpeg", JPEG_QUALITY)
    );
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    onCropped({ mimeType: "image/jpeg", base64 });
  };

  return (
    <div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          width: VIEWPORT_SIZE,
          height: VIEWPORT_SIZE,
          borderRadius: "50%",
          overflow: "hidden",
          margin: "0 auto 12px",
          position: "relative",
          background: "#111827",
          cursor: "grab",
          touchAction: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Crop preview"
          draggable={false}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            maxWidth: "none",
            width: VIEWPORT_SIZE,
            height: "auto",
            userSelect: "none",
          }}
        />
      </div>

      <label style={{ display: "block", fontSize: 12, color: "#6b7280", textAlign: "center" }}>Zoom</label>
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.05}
        value={zoom}
        onChange={(e) => setZoom(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 16 }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: 10 }}>
          Cancel
        </button>
        <button type="button" onClick={confirmCrop} disabled={isSaving} style={{ flex: 1, padding: 10 }}>
          {isSaving ? "Saving…" : "Use photo"}
        </button>
      </div>
    </div>
  );
}
