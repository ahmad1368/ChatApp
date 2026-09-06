"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";
const STORAGE_KEY = "chatapp:theme";

function applyTheme(preference: ThemePreference) {
  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", preference);
  }
}

export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    let stored: ThemePreference = "system";
    try {
      stored = (window.localStorage.getItem(STORAGE_KEY) as ThemePreference) || "system";
    } catch {
      // Storage unavailable — fall back to system preference.
    }
    setPreference(stored);
    applyTheme(stored);
  }, []);

  const cyclePreference = () => {
    const next: ThemePreference = preference === "system" ? "light" : preference === "light" ? "dark" : "system";
    setPreference(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — theme just won't persist across reloads.
    }
  };

  const label = preference === "system" ? "Theme: Auto" : preference === "light" ? "Theme: Light" : "Theme: Dark";

  return (
    <button className="chat-app__theme-toggle" onClick={cyclePreference}>
      {label}
    </button>
  );
}
