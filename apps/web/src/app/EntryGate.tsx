"use client";

import { useEffect, useState } from "react";
import ChatRoom from "./ChatRoom";

const STORAGE_KEY = "chatapp:mode";

/**
 * Tinder-style guest mode: browsing needs no signup, but full access
 * (sending messages, and — once they exist — matching/discovery) does.
 * There's no real member session to check yet (no auth PR — #21-#25 — is
 * merged), so "chose guest" is just a remembered local choice; a signed-up
 * user would bypass this gate entirely once that lands.
 */
export default function EntryGate() {
  const [mode, setMode] = useState<"loading" | "choosing" | "guest">("loading");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage unavailable — just ask each time.
    }
    setMode(stored === "guest" ? "guest" : "choosing");
  }, []);

  const continueAsGuest = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "guest");
    } catch {
      // Storage unavailable — guest choice just won't persist across reloads.
    }
    setMode("guest");
  };

  if (mode === "loading") return null;

  if (mode === "guest") return <ChatRoom isGuest />;

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 16, fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>ChatApp</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>Sign up to send messages, or take a look around first.</p>
      <a
        href="/signup"
        style={{ display: "block", padding: 12, background: "#2563eb", color: "#fff", borderRadius: 8, textDecoration: "none", marginBottom: 12 }}
      >
        Sign up
      </a>
      <button onClick={continueAsGuest} style={{ width: "100%", padding: 12, background: "none", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        Continue as guest
      </button>
    </main>
  );
}
