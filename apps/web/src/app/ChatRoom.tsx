"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";
import {
  loadCachedMessages,
  loadQueuedMessages,
  QueuedMessage,
  saveCachedMessages,
  saveQueuedMessages,
} from "./offlineStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ChatRoom() {
  // Hydrate synchronously from the local cache so there's something on
  // screen immediately, even before the network fetch (or if it never
  // succeeds because we're offline).
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadCachedMessages(DEFAULT_ROOM_ID));
  const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueuedMessages(DEFAULT_ROOM_ID));
  const [text, setText] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const socketRef = useRef<Socket | null>(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(() => {
    saveCachedMessages(DEFAULT_ROOM_ID, messages);
  }, [messages]);

  useEffect(() => {
    saveQueuedMessages(DEFAULT_ROOM_ID, queue);
  }, [queue]);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    fetch(`${API_URL}/api/rooms/${DEFAULT_ROOM_ID}/messages`)
      .then((res) => res.json())
      .then(setMessages)
      .catch(() => {
        // Offline or API unreachable — keep showing whatever was cached.
      });

    const socket = io(API_URL);
    socketRef.current = socket;

    const flushQueue = () => {
      for (const queued of queueRef.current) {
        socket.emit("message:send", { roomId: DEFAULT_ROOM_ID, author: queued.author, text: queued.text });
      }
      setQueue([]);
    };

    socket.on("connect", () => {
      setIsOnline(true);
      socket.emit("join", DEFAULT_ROOM_ID);
      flushQueue();
    });
    socket.on("disconnect", () => setIsOnline(false));
    socket.on("message:new", (message: ChatMessage) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      // The queued entry is now confirmed by the server's own broadcast.
      setQueue((prev) => prev.filter((q) => !(q.author === message.author && q.text === message.text)));
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      socket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");

    if (socketRef.current?.connected) {
      socketRef.current.emit("message:send", { roomId: DEFAULT_ROOM_ID, author, text: trimmed });
      return;
    }

    // Offline (or still connecting): hold the message locally and send it
    // once the socket reconnects instead of dropping it.
    setQueue((prev) => [
      ...prev,
      { clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, author, text: trimmed, queuedAt: new Date().toISOString() },
    ]);
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>ChatApp</h1>
      {!isOnline && (
        <p style={{ fontSize: 12, color: "#c0392b", margin: "0 0 8px" }}>
          Offline — messages you send will be delivered once you're back online.
        </p>
      )}
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, minHeight: 240, marginBottom: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 6 }}>
            <strong>{m.author}: </strong>
            <span>{m.text}</span>
          </div>
        ))}
        {queue.map((q) => (
          <div key={q.clientId} style={{ marginBottom: 6, opacity: 0.6 }}>
            <strong>{q.author}: </strong>
            <span>{q.text}</span>
            <em style={{ fontSize: 11, marginLeft: 6 }}>(queued)</em>
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
