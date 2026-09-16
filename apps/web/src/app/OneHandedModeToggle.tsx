"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "chatapp:oneHandedMode";

function applyOneHandedMode(enabled: boolean) {
  if (enabled) {
    document.documentElement.setAttribute("data-one-handed", "true");
  } else {
    document.documentElement.removeAttribute("data-one-handed");
  }
}

/**
 * Bumble's real "One-Handed Mode for easy use" (#249) — same client-only,
 * localStorage-persisted pattern as #8's ThemeToggle/#242's
 * FontSizeToggle/#243's HighContrastToggle (a pure display preference, no
 * account/backend needed). Drives a real `data-one-handed="true"`
 * attribute on `<html>` that globals.css uses to shrink and bottom-anchor
 * the whole chat surface into a genuine one-thumb-reachable corner — the
 * same idea a phone OS's own one-handed mode uses — rather than an
 * exhaustive per-control reachability redesign.
 */
export default function OneHandedModeToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      // Storage unavailable — fall back to disabled.
    }
    setEnabled(stored);
    applyOneHandedMode(stored);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    applyOneHandedMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage unavailable — the setting just won't persist across reloads.
    }
  };

  return (
    <button
      className="chat-app__theme-toggle"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "One-handed mode: On" : "One-handed mode: Off"}
    >
      {enabled ? "🤏 One-handed: On" : "🤏 One-handed: Off"}
    </button>
  );
}
