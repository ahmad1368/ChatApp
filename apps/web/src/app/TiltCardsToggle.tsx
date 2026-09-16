"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "chatapp:tiltCardsEnabled";

/**
 * Tinder's real "Show profile as 3D tilt-effect cards" (#296) — same
 * client-only, localStorage-persisted toggle pattern as #242/#243/#249.
 * See TiltCard.tsx for the actual pointer-driven 3D transform.
 */
export default function TiltCardsToggle({ enabled, onChange }: { enabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      aria-label={enabled ? "3D tilt cards: On" : "3D tilt cards: Off"}
      style={{ fontSize: 12 }}
    >
      {enabled ? "🎴 3D tilt: On" : "🎴 3D tilt: Off"}
    </button>
  );
}

export function useTiltCardsPreference(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Storage unavailable — fall back to disabled.
    }
  }, []);

  const update = (next: boolean) => {
    setEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage unavailable — the setting just won't persist across reloads.
    }
  };

  return [enabled, update];
}
