"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [blockedAuthors, setBlockedAuthors] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const refreshMessages = () => {
    fetch(`${API_URL}/api/rooms/${DEFAULT_ROOM_ID}/messages?viewer=${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then(setMessages)
      .catch(() => setMessages([]));
  };

  const refreshBlockedAuthors = () => {
    fetch(`${API_URL}/api/blocks/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setBlockedAuthors(body.blockedAuthors ?? []))
      .catch(() => setBlockedAuthors([]));
  };

  useEffect(() => {
    refreshMessages();
    refreshBlockedAuthors();

    const socket = io(API_URL);
    socketRef.current = socket;
    socket.emit("identify", author);
    socket.emit("join", DEFAULT_ROOM_ID);
    socket.on("message:new", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.disconnect();
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

  const blockUser = async (blockedAuthor: string) => {
    if (!confirm(`Block ${blockedAuthor}? You won't see each other's messages anymore.`)) return;
    await fetch(`${API_URL}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: author, blockedAuthor }),
    });
    setBlockedAuthors((prev) => [...prev, blockedAuthor]);
    setMessages((prev) => prev.filter((m) => m.author !== blockedAuthor));
  };

  const unblockUser = async (blockedAuthor: string) => {
    await fetch(`${API_URL}/api/blocks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: author, blockedAuthor }),
    });
    setBlockedAuthors((prev) => prev.filter((a) => a !== blockedAuthor));
  };

  const visibleMessages = messages.filter((m) => !blockedAuthors.includes(m.author));

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>ChatApp</h1>
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, minHeight: 240, marginBottom: 12 }}>
        {visibleMessages.map((m) => (
          <div key={m.id} style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>
              <strong>{m.author}: </strong>
              <span>{m.text}</span>
            </span>
            {m.author !== author && (
              <button
                onClick={() => blockUser(m.author)}
                title={`Block ${m.author}`}
                style={{ fontSize: 12, cursor: "pointer" }}
              >
                🚫 Block
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
      {blockedAuthors.length > 0 && (
        <div style={{ fontSize: 13, color: "#555" }}>
          <strong>Blocked users:</strong>
          <ul style={{ paddingLeft: 16 }}>
            {blockedAuthors.map((blockedAuthor) => (
              <li key={blockedAuthor}>
                {blockedAuthor}{" "}
                <button onClick={() => unblockUser(blockedAuthor)} style={{ fontSize: 12, cursor: "pointer" }}>
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
