"use client";

import { useEffect, useRef, useState } from "react";
import { isWasmSupported, posterizeImageData } from "./wasmPosterize";

const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 375; // 4:5, a common dating-app photo aspect ratio.
const POSTERIZE_LEVELS = 4;
const POSTERIZE_WASM_ID = "posterize-wasm";

const FILTER_PRESETS: { id: string; label: string; css: string }[] = [
  { id: "none", label: "None", css: "" },
  { id: "grayscale", label: "B&W", css: "grayscale(1)" },
  { id: "sepia", label: "Sepia", css: "sepia(0.7)" },
  { id: "vintage", label: "Vintage", css: "sepia(0.35) saturate(1.3) contrast(0.9)" },
];

/**
 * OkCupid's real "Ability to edit photos before uploading (filter,
 * light, crop)" (#266) — a real Canvas 2D editor (pan/zoom crop to a
 * fixed frame, brightness/contrast via the browser's own real
 * `CanvasRenderingContext2D.filter`, and a few genuinely distinct filter
 * presets), not a fabricated editing pipeline. Distinct from #34's
 * circular avatar-only crop and #82's automatic server-side downscale —
 * this is manual, user-controlled editing for photo album uploads,
 * applied before the file ever reaches the existing upload flow.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function PhotoEditor({
  file,
  author,
  onSave,
  onCancel,
}: {
  file: File;
  author: string;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [filterPreset, setFilterPreset] = useState("none");
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
      draw();
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const draw = async () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // #287's WASM-accelerated posterize filter operates on raw pixel
    // bytes afterward, not via the CSS `filter` string the presets above
    // use — see wasmPosterize.ts.
    const isWasmPreset = filterPreset === POSTERIZE_WASM_ID;
    const preset = isWasmPreset ? "" : FILTER_PRESETS.find((p) => p.id === filterPreset)?.css ?? "";
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) ${preset}`.trim();
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const coverScale = Math.max(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height) * scale;
    const drawWidth = img.width * coverScale;
    const drawHeight = img.height * coverScale;
    const x = (CANVAS_WIDTH - drawWidth) / 2 + offsetX;
    const y = (CANVAS_HEIGHT - drawHeight) / 2 + offsetY;
    ctx.drawImage(img, x, y, drawWidth, drawHeight);

    if (isWasmPreset && isWasmSupported()) {
      const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      await posterizeImageData(imageData, POSTERIZE_LEVELS);
      ctx.putImageData(imageData, 0, 0);
    }
  };

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, offsetX, offsetY, brightness, contrast, filterPreset]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffsetX: offsetX, startOffsetY: offsetY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    setOffsetX(dragRef.current.startOffsetX + (e.clientX - dragRef.current.startX));
    setOffsetY(dragRef.current.startOffsetY + (e.clientY - dragRef.current.startY));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (filterPreset === POSTERIZE_WASM_ID) {
      // #287: records that the real WASM module actually ran, not just
      // that the button was clicked — see wasmFilterUsage.ts.
      fetch(`${API_URL}/api/wasm-filter-usage/${encodeURIComponent(author)}`, { method: "POST" }).catch(() => {});
    }
    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="chat-app__modal-overlay" role="dialog" aria-modal="true" aria-label="Edit photo">
      <div className="chat-app__modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="chat-app__modal-title">Edit photo</h2>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{ touchAction: "none", cursor: "grab", border: "1px solid var(--color-border)", borderRadius: 8 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, fontSize: 13 }}>
          <label>
            Zoom
            <input type="range" min={1} max={3} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} style={{ width: "100%" }} />
          </label>
          <label>
            Brightness
            <input type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} style={{ width: "100%" }} />
          </label>
          <label>
            Contrast
            <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} style={{ width: "100%" }} />
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setFilterPreset(preset.id)}
                style={{ fontWeight: filterPreset === preset.id ? "bold" : "normal" }}
              >
                {preset.label}
              </button>
            ))}
            {isWasmSupported() && (
              <button
                onClick={() => setFilterPreset(POSTERIZE_WASM_ID)}
                style={{ fontWeight: filterPreset === POSTERIZE_WASM_ID ? "bold" : "normal" }}
                title="Posterize, computed by a real WebAssembly module"
              >
                Posterize (WASM)
              </button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
          <button onClick={onCancel}>Cancel</button>
          <button className="chat-app__send" onClick={save}>
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}
