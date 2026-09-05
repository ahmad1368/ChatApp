"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// PushManager.subscribe needs the VAPID public key as a Uint8Array, but the
// server hands it over base64url-encoded.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type WebPushStatus = "unsupported" | "default" | "subscribing" | "subscribed" | "denied";

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus>("unsupported");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    if (!supported) return;

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        setWebPushStatus("subscribed");
      } else if (Notification.permission === "denied") {
        setWebPushStatus("denied");
      } else {
        setWebPushStatus("default");
      }
    });
  }, []);

  const enableWebPush = async () => {
    setWebPushStatus("subscribing");
    try {
      const registration = await navigator.serviceWorker.ready;
      const { publicKey } = await fetch(`${API_URL}/api/push/public-key`).then((res) => res.json());
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      await fetch(`${API_URL}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, subscription: subscription.toJSON() }),
      });
      setWebPushStatus("subscribed");
    } catch (err) {
      console.error("Web Push subscription failed:", err);
      setWebPushStatus(Notification.permission === "denied" ? "denied" : "default");
    }
  };

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
      <h1>ChatApp</h1>
      {(webPushStatus === "default" || webPushStatus === "subscribing" || webPushStatus === "denied") && (
        <button
          onClick={enableWebPush}
          disabled={webPushStatus === "subscribing" || webPushStatus === "denied"}
          style={{ marginBottom: 12, padding: "6px 12px", fontSize: 13 }}
        >
          {webPushStatus === "subscribing" && "Enabling…"}
          {webPushStatus === "denied" && "Push notifications blocked (enable in browser settings)"}
          {webPushStatus === "default" && "Enable push notifications"}
        </button>
      )}
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
