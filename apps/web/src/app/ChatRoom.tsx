"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ChatRoom({ roomId = DEFAULT_ROOM_ID }: { roomId?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const searchParams = useSearchParams();
  const deepLinkedMessageId = searchParams.get("m");

  useEffect(() => {
    fetch(`${API_URL}/api/rooms/${roomId}/messages`)
      .then((res) => res.json())
      .then(setMessages)
      .catch(() => setMessages([]));

    const socket = io(API_URL);
    socketRef.current = socket;
    socket.emit("join", roomId);
    socket.on("message:new", (message: ChatMessage) => {
      if (message.roomId === roomId) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  // Deep link support: jump to and briefly highlight a specific message
  // (e.g. from a shared /room/<id>?m=<messageId> link) once it's rendered.
  useEffect(() => {
    if (!deepLinkedMessageId) return;
    const el = messageRefs.current.get(deepLinkedMessageId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(deepLinkedMessageId);
    const timeout = setTimeout(() => setHighlightedId(null), 2500);
    return () => clearTimeout(timeout);
  }, [deepLinkedMessageId, messages]);

  const sendMessage = () => {
    if (!text.trim() || !socketRef.current) return;
    socketRef.current.emit("message:send", {
      roomId,
      author,
      text: text.trim(),
    });
    setText("");
  };

  const copyMessageLink = (messageId: string) => {
    const url = `${window.location.origin}/room/${roomId}?m=${messageId}`;
    navigator.clipboard?.writeText(url).catch(() => {
      // Clipboard API unavailable/denied — link is still shareable manually via the URL bar.
    });
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>ChatApp</h1>
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, minHeight: 240, marginBottom: 12 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            ref={(el) => {
              if (el) messageRefs.current.set(m.id, el);
              else messageRefs.current.delete(m.id);
            }}
            style={{
              marginBottom: 6,
              padding: 4,
              borderRadius: 4,
              background: highlightedId === m.id ? "#fff3cd" : "transparent",
              transition: "background 0.3s",
            }}
          >
            <strong>{m.author}: </strong>
            <span>{m.text}</span>
            <button
              onClick={() => copyMessageLink(m.id)}
              title="Copy link to this message"
              style={{
                marginLeft: 6,
                fontSize: 11,
                border: "none",
                background: "none",
                color: "#6b7280",
                cursor: "pointer",
              }}
            >
              🔗
            </button>
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
