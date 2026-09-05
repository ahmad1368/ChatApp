"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 20;

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only fetch the most recent page on load — the client shouldn't pay to
    // download the entire room history (and its data cost) just to render
    // the last screenful of messages.
    fetch(`${API_URL}/api/rooms/${DEFAULT_ROOM_ID}/messages?limit=${PAGE_SIZE}`)
      .then((res) => {
        setHasMore(res.headers.get("x-has-more") === "true");
        return res.json();
      })
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

  const loadOlderMessages = () => {
    const oldest = messages[0];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    fetch(`${API_URL}/api/rooms/${DEFAULT_ROOM_ID}/messages?limit=${PAGE_SIZE}&before=${oldest.id}`)
      .then((res) => {
        setHasMore(res.headers.get("x-has-more") === "true");
        return res.json();
      })
      .then((older: ChatMessage[]) => setMessages((prev) => [...older, ...prev]))
      .finally(() => setLoadingMore(false));
  };

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
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, minHeight: 240, marginBottom: 12 }}>
        {hasMore && (
          <button onClick={loadOlderMessages} disabled={loadingMore} style={{ fontSize: 12, marginBottom: 8 }}>
            {loadingMore ? "Loading…" : "Load older messages"}
          </button>
        )}
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
