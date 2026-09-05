"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [watermarkLabel, setWatermarkLabel] = useState<string | null>(null);
  const [obscured, setObscured] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms/${DEFAULT_ROOM_ID}/messages`)
      .then((res) => res.json())
      .then(setMessages)
      .catch(() => setMessages([]));

    // No browser API can block or detect an OS-level screenshot, so we deter +
    // trace instead: stamp a per-session code (author + trace code) into a
    // faint on-screen watermark, so a leaked screenshot is traceable.
    fetch(`${API_URL}/api/watermark/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, roomId: DEFAULT_ROOM_ID }),
    })
      .then((res) => res.json())
      .then((session) => setWatermarkLabel(`${session.author} · ${session.traceCode}`))
      .catch(() => setWatermarkLabel(null));

    const socket = io(API_URL);
    socketRef.current = socket;
    socket.emit("join", DEFAULT_ROOM_ID);
    socket.on("message:new", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    // Defense-in-depth for screen-sharing/shoulder-surfing: blur chat content
    // whenever the tab isn't the visible, focused one.
    const handleVisibility = () => setObscured(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", () => setObscured(true));
    window.addEventListener("focus", () => setObscured(false));

    return () => {
      socket.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = () => {
    if (!text.trim() || !socketRef.current) return;
    socketRef.current.emit("message:send", {
      roomId: DEFAULT_ROOM_ID,
      author,
      text: text.trim(),
    });
    setText("");
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>ChatApp</h1>
      <p style={{ fontSize: 12, color: "#888" }}>
        Browsers can&apos;t block screenshots — chat content is watermarked and traceable instead.
      </p>
      <div
        style={{
          position: "relative",
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: 12,
          minHeight: 240,
          marginBottom: 12,
          overflow: "hidden",
          filter: obscured ? "blur(12px)" : "none",
          transition: "filter 120ms ease",
        }}
      >
        {watermarkLabel && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              display: "flex",
              flexWrap: "wrap",
              alignContent: "space-around",
              justifyContent: "space-around",
              opacity: 0.12,
              fontSize: 12,
              transform: "rotate(-20deg)",
              userSelect: "none",
            }}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i}>{watermarkLabel}</span>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 6, position: "relative" }}>
            <strong>{m.author}: </strong>
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </main>
  );
}
