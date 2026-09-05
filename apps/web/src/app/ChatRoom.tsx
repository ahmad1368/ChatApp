"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(
    "unsupported"
  );
  const socketRef = useRef<Socket | null>(null);
  const authorRef = useRef(author);
  authorRef.current = author;

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission as NotificationPermissionState);
    }
  }, []);

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

      // Mirrors mobile push notifications for the web: alert the user about
      // new messages while the tab is backgrounded, without needing a push
      // server (see Web Push, tracked separately, for closed-tab delivery).
      const isOwnMessage = message.author === authorRef.current;
      const canNotify = "Notification" in window && Notification.permission === "granted";
      if (!isOwnMessage && document.hidden && canNotify) {
        new Notification(message.author, { body: message.text, tag: DEFAULT_ROOM_ID });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result as NotificationPermissionState);
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
      {notificationPermission !== "unsupported" && notificationPermission !== "granted" && (
        <button
          onClick={requestNotificationPermission}
          disabled={notificationPermission === "denied"}
          style={{ marginBottom: 12, padding: "6px 12px", fontSize: 13 }}
        >
          {notificationPermission === "denied"
            ? "Notifications blocked (enable in browser settings)"
            : "Enable message notifications"}
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
