"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";
import { compressImage } from "./imageCompression";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const sendImage = async (file: File) => {
    setImageError(null);
    setIsSendingImage(true);
    try {
      const { mimeType, base64 } = await compressImage(file);
      const uploadRes = await fetch(`${API_URL}/api/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType, data: base64 }),
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const { url } = await uploadRes.json();
      socketRef.current?.emit("message:send", {
        roomId: DEFAULT_ROOM_ID,
        author,
        text: "",
        imageUrl: `${API_URL}${url}`,
      });
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Failed to send image");
    } finally {
      setIsSendingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) sendImage(file);
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>ChatApp</h1>
      {imageError && <p style={{ fontSize: 12, color: "#c0392b" }}>{imageError}</p>}
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, minHeight: 240, marginBottom: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 6 }}>
            <strong>{m.author}: </strong>
            {m.imageUrl ? (
              <img src={m.imageUrl} alt="Shared" loading="lazy" style={{ maxWidth: "100%", borderRadius: 6, display: "block", marginTop: 4 }} />
            ) : (
              <span>{m.text}</span>
            )}
          </div>
        ))}
        {isSendingImage && <div style={{ fontSize: 12, color: "#6b7280" }}>Compressing and sending image…</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message"
          style={{ flex: 1, padding: 8 }}
        />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={isSendingImage} title="Send an image">
          📷
        </button>
        <button onClick={sendMessage}>Send</button>
      </div>
    </main>
  );
}
