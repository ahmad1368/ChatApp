"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "chatapp:chatTheme";

const THEMES = [
  { id: "classic", label: "Classic" },
  { id: "sunset", label: "Sunset" },
  { id: "nightDate", label: "Night date" },
] as const;
type ChatThemeId = (typeof THEMES)[number]["id"];

function applyChatTheme(theme: ChatThemeId) {
  if (theme === "classic") {
    document.documentElement.removeAttribute("data-chat-theme");
  } else {
    document.documentElement.setAttribute("data-chat-theme", theme);
  }
}

/**
 * Tinder's real "Ability to switch chat theme (night date, sunset,
 * classic)" (#303) — same client-only, localStorage-persisted display-
 * preference pattern as #8's ThemeToggle/#242/#243/#249 (a themed chat
 * wallpaper, not an account setting). Drives a real `data-chat-theme`
 * attribute on `<html>` that globals.css uses to swap the message-list
 * background — "classic" is simply the attribute removed, falling back
 * to the existing panel background (light/dark-aware already).
 */
export default function ChatThemeToggle() {
  const [theme, setTheme] = useState<ChatThemeId>("classic");

  useEffect(() => {
    let stored: ChatThemeId = "classic";
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "sunset" || raw === "nightDate") stored = raw;
    } catch {
      // Storage unavailable — fall back to classic.
    }
    setTheme(stored);
    applyChatTheme(stored);
  }, []);

  const cycleTheme = () => {
    const currentIndex = THEMES.findIndex((t) => t.id === theme);
    const next = THEMES[(currentIndex + 1) % THEMES.length].id;
    setTheme(next);
    applyChatTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the setting just won't persist across reloads.
    }
  };

  const label = THEMES.find((t) => t.id === theme)?.label ?? "Classic";

  return (
    <button className="chat-app__theme-toggle" onClick={cycleTheme} aria-label={`Chat theme: ${label}`}>
      🎨 {label}
    </button>
  );
}
