"use client";

import { useEffect, useState } from "react";

type FontFamilyPreference = "system" | "serif" | "monospace" | "rounded";
const STORAGE_KEY = "chatapp:fontFamily";
const ORDER: FontFamilyPreference[] = ["system", "serif", "monospace", "rounded"];
const LABEL: Record<FontFamilyPreference, string> = {
  system: "Font: Default",
  serif: "Font: Serif",
  monospace: "Font: Monospace",
  rounded: "Font: Rounded",
};

function applyFontFamily(preference: FontFamilyPreference) {
  if (preference === "system") {
    document.documentElement.removeAttribute("data-font-family");
  } else {
    document.documentElement.setAttribute("data-font-family", preference);
  }
}

/**
 * Tinder's real "Ability to set a custom app font" (#328) — same client-
 * only, localStorage-persisted display-preference pattern as #8's
 * ThemeToggle and #242's FontSizeToggle. A fixed catalog of real, always-
 * available web-safe font stacks (serif/monospace/rounded) rather than a
 * Google Fonts network fetch this app has no need to depend on — drives a
 * new `--app-font-family` custom property via a `data-font-family`
 * attribute on `<html>`.
 */
export default function FontFamilyToggle() {
  const [preference, setPreference] = useState<FontFamilyPreference>("system");

  useEffect(() => {
    let stored: FontFamilyPreference = "system";
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw && ORDER.includes(raw as FontFamilyPreference)) stored = raw as FontFamilyPreference;
    } catch {
      // Storage unavailable — fall back to the default font.
    }
    setPreference(stored);
    applyFontFamily(stored);
  }, []);

  const cyclePreference = () => {
    const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
    setPreference(next);
    applyFontFamily(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the font just won't persist across reloads.
    }
  };

  return (
    <button className="chat-app__theme-toggle" onClick={cyclePreference} aria-label={LABEL[preference]}>
      {LABEL[preference]}
    </button>
  );
}
