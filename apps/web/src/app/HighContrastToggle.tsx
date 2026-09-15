"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "chatapp:highContrast";

function applyHighContrast(enabled: boolean) {
  if (enabled) {
    document.documentElement.setAttribute("data-contrast", "high");
  } else {
    document.documentElement.removeAttribute("data-contrast");
  }
}

/**
 * Bumble's real "High Contrast Mode for low-vision users" (#243) — same
 * client-only, localStorage-persisted pattern as #8's ThemeToggle and
 * #242's FontSizeToggle (a pure display preference, no account/backend
 * needed). Drives real WCAG-AA/AAA-exceeding color overrides in
 * globals.css via a `data-contrast="high"` attribute on `<html>`, not a
 * cosmetic theme variant.
 */
export default function HighContrastToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      // Storage unavailable — fall back to disabled.
    }
    setEnabled(stored);
    applyHighContrast(stored);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    applyHighContrast(next);
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
      aria-label={enabled ? "High contrast: On" : "High contrast: Off"}
    >
      {enabled ? "High contrast: On" : "High contrast: Off"}
    </button>
  );
}
