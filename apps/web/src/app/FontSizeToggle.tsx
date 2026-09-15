"use client";

import { useEffect, useState } from "react";

type FontSizePreference = "medium" | "small" | "large" | "xlarge";
const STORAGE_KEY = "chatapp:fontSize";
const ORDER: FontSizePreference[] = ["medium", "small", "large", "xlarge"];
const LABEL: Record<FontSizePreference, string> = {
  medium: "Text size: Default",
  small: "Text size: Small",
  large: "Text size: Large",
  xlarge: "Text size: Extra Large",
};

function applyFontSize(preference: FontSizePreference) {
  if (preference === "medium") {
    document.documentElement.removeAttribute("data-font-size");
  } else {
    document.documentElement.setAttribute("data-font-size", preference);
  }
}

/**
 * Tinder's real "Ability to change text font size in the app" (#242) —
 * same client-only, localStorage-persisted pattern as #8's ThemeToggle
 * (a pure display preference, no account/backend needed). Drives the
 * existing `--chat-font-size` custom property (already used throughout
 * `globals.css`) via a `data-font-size` attribute on `<html>`, so every
 * element already sized off that variable picks up the change with no
 * further wiring.
 */
export default function FontSizeToggle() {
  const [preference, setPreference] = useState<FontSizePreference>("medium");

  useEffect(() => {
    let stored: FontSizePreference = "medium";
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw && ORDER.includes(raw as FontSizePreference)) stored = raw as FontSizePreference;
    } catch {
      // Storage unavailable — fall back to the default size.
    }
    setPreference(stored);
    applyFontSize(stored);
  }, []);

  const cyclePreference = () => {
    const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
    setPreference(next);
    applyFontSize(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the size just won't persist across reloads.
    }
  };

  return (
    <button className="chat-app__theme-toggle" onClick={cyclePreference} aria-label={LABEL[preference]}>
      {LABEL[preference]}
    </button>
  );
}
