"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// How long the tab can sit hidden before we drop the live connection to save
// battery/data. Background delivery is still covered by Web Push (see #5);
// this just avoids an idle socket burning power while nobody is looking.
const DISCONNECT_AFTER_HIDDEN_MS = 2 * 60 * 1000;

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
}

function getNetworkInfo(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

function prefersReducedData(): boolean {
  const connection = getNetworkInfo();
  return Boolean(connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g");
}

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  // On a metered/slow connection, don't auto-open the live socket — let the
  // user opt in instead of spending their data budget on a connection they
  // didn't ask for.
  const [liveUpdatesEnabled, setLiveUpdatesEnabled] = useState(() => !prefersReducedData());
  const socketRef = useRef<Socket | null>(null);
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms/${DEFAULT_ROOM_ID}/messages`)
      .then((res) => res.json())
      .then(setMessages)
      .catch(() => setMessages([]));
  }, []);

  useEffect(() => {
    if (!liveUpdatesEnabled) return;

    const socket = io(API_URL, {
      // Skip the HTTP long-polling handshake and go straight to a WebSocket
      // to cut data usage on every (re)connect.
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
    });
    socketRef.current = socket;
    socket.emit("join", DEFAULT_ROOM_ID);
    socket.on("message:new", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    const clearHiddenTimer = () => {
      if (hiddenTimerRef.current) {
        clearTimeout(hiddenTimerRef.current);
        hiddenTimerRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearHiddenTimer();
        hiddenTimerRef.current = setTimeout(() => socket.disconnect(), DISCONNECT_AFTER_HIDDEN_MS);
      } else {
        clearHiddenTimer();
        if (!socket.connected) socket.connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearHiddenTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      socket.disconnect();
    };
  }, [liveUpdatesEnabled]);

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
      {!liveUpdatesEnabled && (
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          <span style={{ color: "#6b7280" }}>Data Saver detected — live updates are paused. </span>
          <button onClick={() => setLiveUpdatesEnabled(true)} style={{ fontSize: 13 }}>
            Enable live chat
          </button>
        </div>
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
          disabled={!liveUpdatesEnabled}
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={sendMessage} disabled={!liveUpdatesEnabled}>
          Send
        </button>
      </div>
    </main>
  );
}
