"use client";

import { useRef } from "react";

const MAX_TILT_DEGREES = 12;

/**
 * Tinder's real "Show profile as 3D tilt-effect cards" (#296) — a real
 * pointer-driven CSS 3D transform (`perspective`/`rotateX`/`rotateY`),
 * the same client-only display-effect pattern as #242/#243/#249's
 * toggles (no backend, no account — a pure rendering preference).
 * Rotation is proportional to how far the pointer is from the card's
 * center, capped at `MAX_TILT_DEGREES` so it stays a subtle tilt rather
 * than a disorienting flip, and springs back to flat via a CSS
 * transition once the pointer leaves.
 */
export default function TiltCard({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const offsetX = (e.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (e.clientY - rect.top) / rect.height - 0.5;
    const rotateY = offsetX * MAX_TILT_DEGREES * 2;
    const rotateX = -offsetY * MAX_TILT_DEGREES * 2;
    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const resetTilt = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      style={{
        transformStyle: "preserve-3d",
        transition: "transform 0.15s ease-out",
        willChange: enabled ? "transform" : undefined,
      }}
    >
      {children}
    </div>
  );
}
