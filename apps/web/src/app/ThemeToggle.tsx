"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark" | "auto-time";
const STORAGE_KEY = "chatapp:theme";
// Tinder's real "Support for automatic theme switching by time of
// day/night" (#321) — a fixed local-time dusk/dawn window, not a real
// sunset-time API/geolocation lookup this app has no credentials for
// (same honest scoping as #299's GPS heuristic): dark from 8pm to just
// before 7am local time, light otherwise.
const AUTO_TIME_DARK_START_HOUR = 20;
const AUTO_TIME_DARK_END_HOUR = 7;
const AUTO_TIME_RECHECK_MS = 60_000;

function isDarkHourNow(): boolean {
  const hour = new Date().getHours();
  return hour >= AUTO_TIME_DARK_START_HOUR || hour < AUTO_TIME_DARK_END_HOUR;
}

function applyTheme(preference: ThemePreference) {
  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else if (preference === "auto-time") {
    document.documentElement.setAttribute("data-theme", isDarkHourNow() ? "dark" : "light");
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

  useEffect(() => {
    if (preference !== "auto-time") return;
    const interval = setInterval(() => applyTheme("auto-time"), AUTO_TIME_RECHECK_MS);
    return () => clearInterval(interval);
  }, [preference]);

  const cyclePreference = () => {
    const order: ThemePreference[] = ["system", "light", "dark", "auto-time"];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    setPreference(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — theme just won't persist across reloads.
    }
  };

  const label =
    preference === "system"
      ? "Theme: Auto"
      : preference === "light"
        ? "Theme: Light"
        : preference === "dark"
          ? "Theme: Dark"
          : "Theme: Day/Night";

  return (
    <button className="chat-app__theme-toggle" onClick={cyclePreference}>
      {label}
    </button>
  );
}
