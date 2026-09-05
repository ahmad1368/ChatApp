"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms/${DEFAULT_ROOM_ID}/messages`)
      .then((res) => res.json())
      .then(setMessages)
      .catch(() => setMessages([]));

    const socket = io(API_URL);
    socketRef.current = socket;
    socket.emit("join", DEFAULT_ROOM_ID);
    socket.on("message:new", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.disconnect();
    };
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>ChatApp</h1>
        <Link href={`/privacy?author=${encodeURIComponent(author)}`} style={{ fontSize: 13 }}>
          Privacy
        </Link>
      </div>
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, minHeight: 240, marginBottom: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 6 }}>
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
