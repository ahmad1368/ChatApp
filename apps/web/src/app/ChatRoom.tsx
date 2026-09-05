"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
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

  const uploadPhoto = async (file: File) => {
    setPhotoError(null);
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(",")[1] ?? "";

    const res = await fetch(`${API_URL}/api/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, mimeType: file.type, data: base64 }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPhotoError(body.error ?? "Failed to upload photo");
      return;
    }
    const body = await res.json();
    setPhotoId(body.id);
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>ChatApp</h1>
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

      <section style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
        <h2 style={{ fontSize: 14 }}>Profile photo</h2>
        <p style={{ color: "#666" }}>
          Uploaded photos are watermarked with your name every time they&apos;re served, to deter
          photo theft — the watermark is burned into the image itself, not just shown on top of it.
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
        />
        {photoError && <p style={{ color: "#b00020" }}>{photoError}</p>}
        {photoId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_URL}/api/photos/${photoId}?viewer=${encodeURIComponent(author)}`}
            alt="Watermarked upload preview"
            style={{ marginTop: 8, maxWidth: "100%", borderRadius: 8 }}
          />
        )}
      </section>
    </main>
  );
}
