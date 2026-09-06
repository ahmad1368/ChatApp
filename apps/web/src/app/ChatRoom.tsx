"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  const additions = incoming.filter((m) => !seen.has(m.id));
  return additions.length ? [...prev, ...additions] : prev;
}

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [syncStatus, setSyncStatus] = useState<"connecting" | "synced" | "offline">("connecting");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const socketRef = useRef<Socket | null>(null);
  // Tracks the newest message timestamp we've seen locally so that on
  // reconnect (dropped wifi, backgrounded tab, another device catching up)
  // we only fetch what we missed instead of the whole history again.
  const lastSyncedAtRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const syncSince = (since?: string) =>
      fetch(
        `${API_URL}/api/rooms/${DEFAULT_ROOM_ID}/messages${since ? `?since=${encodeURIComponent(since)}` : ""}`
      )
        .then((res) => res.json())
        .then((incoming: ChatMessage[]) => {
          if (incoming.length) {
            lastSyncedAtRef.current = incoming[incoming.length - 1].createdAt;
          }
          setMessages((prev) => (since ? mergeMessages(prev, incoming) : incoming));
          setSyncStatus("synced");
        })
        .catch(() => setSyncStatus("offline"));

    syncSince();

    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", DEFAULT_ROOM_ID);
      // Reconnect sync: catch up on anything sent while we were disconnected.
      syncSince(lastSyncedAtRef.current);
    });
    socket.on("disconnect", () => setSyncStatus("offline"));
    socket.on("message:new", (message: ChatMessage) => {
      lastSyncedAtRef.current = message.createdAt;
      setMessages((prev) => mergeMessages(prev, [message]));
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
    <main className="chat-app">
      <div className="chat-app__header">
        <h1>ChatApp</h1>
        <div className="chat-app__header-links">
          <Link href={`/privacy?author=${encodeURIComponent(author)}`}>Privacy</Link>
          <Link href={`/privacy/export?author=${encodeURIComponent(author)}`}>Download my data</Link>
          <Link href={`/privacy/location?author=${encodeURIComponent(author)}`}>Location privacy</Link>
        </div>
      </div>
      <p
        role="status"
        className={`chat-app__status${syncStatus === "offline" ? " chat-app__status--offline" : ""}`}
      >
        {syncStatus === "connecting" && "Connecting…"}
        {syncStatus === "synced" && "Synced"}
        {syncStatus === "offline" && "Offline — reconnecting…"}
      </p>
      <div className="chat-app__messages">
        {messages.map((m) => (
          <div key={m.id} className="chat-app__message">
            <strong>{m.author}: </strong>
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <div className="chat-app__composer">
        <input
          className="chat-app__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message"
        />
        <button className="chat-app__send" onClick={sendMessage}>
          Send
        </button>
      </div>
    </main>
  );
}
