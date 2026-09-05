"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";
import { loadDataSaverPreference, saveDataSaverPreference } from "./dataSaverStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [dataSaverEnabled, setDataSaverEnabled] = useState(false);
  // In Data Saver Mode, chat data only loads once the user explicitly asks
  // for it — this flag tracks that manual opt-in for the current session.
  const [manuallyStarted, setManuallyStarted] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setDataSaverEnabled(loadDataSaverPreference());
  }, []);

  const chatActive = !dataSaverEnabled || manuallyStarted;

  useEffect(() => {
    if (!chatActive) return;

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
      socketRef.current = null;
    };
  }, [chatActive]);

  const toggleDataSaver = () => {
    const next = !dataSaverEnabled;
    setDataSaverEnabled(next);
    saveDataSaverPreference(next);
    if (next) {
      // Re-enabling Data Saver mid-session should stop the live connection
      // again rather than only affecting the next page load.
      setManuallyStarted(false);
    }
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>ChatApp</h1>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={dataSaverEnabled} onChange={toggleDataSaver} />
          Data Saver Mode
        </label>
      </div>
      {dataSaverEnabled && !manuallyStarted ? (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13, color: "#4b5563" }}>
          Data Saver Mode is on — the chat won't load messages or open a live connection until you ask it to.
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setManuallyStarted(true)}>Load chat</button>
          </div>
        </div>
      ) : (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, minHeight: 240, marginBottom: 12 }}>
          {messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 6 }}>
              <strong>{m.author}: </strong>
              <span>{m.text}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message"
          disabled={!chatActive}
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={sendMessage} disabled={!chatActive}>
          Send
        </button>
      </div>
    </main>
  );
}
