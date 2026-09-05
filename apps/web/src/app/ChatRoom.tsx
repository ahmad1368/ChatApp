"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SWIPE_TRIGGER_PX = 56;
const SWIPE_MAX_PX = 84;

interface ReplyTarget {
  id: string;
  author: string;
  text: string;
}

// Pointer Events unify mouse/touch/pen; dragging only ever changes a CSS
// transform (never layout), and updates are batched via requestAnimationFrame
// so the swipe tracks the finger at 60fps instead of fighting reflow/paint.
function useSwipeToReply(onTrigger: () => void) {
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const queueDragX = (value: number) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => setDragX(value));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) return;
    const delta = e.clientX - startXRef.current;
    queueDragX(Math.max(0, Math.min(delta, SWIPE_MAX_PX)));
  };

  const endSwipe = () => {
    if (startXRef.current !== null && dragX >= SWIPE_TRIGGER_PX) onTrigger();
    startXRef.current = null;
    queueDragX(0);
  };

  return {
    dragX,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endSwipe,
      onPointerCancel: endSwipe,
      // Let the browser keep handling vertical scroll; only the horizontal
      // swipe gesture is ours to intercept.
      style: { touchAction: "pan-y" as const },
    },
  };
}

function MessageRow({ message, onReply }: { message: ChatMessage; onReply: (target: ReplyTarget) => void }) {
  const { dragX, handlers } = useSwipeToReply(() =>
    onReply({ id: message.id, author: message.author, text: message.text })
  );

  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          paddingLeft: 4,
          opacity: Math.min(dragX / SWIPE_TRIGGER_PX, 1),
          fontSize: 16,
        }}
        aria-hidden
      >
        ↩
      </div>
      <div
        {...handlers}
        style={{ ...handlers.style, transform: `translateX(${dragX}px)`, willChange: "transform", background: "#fff" }}
      >
        {message.replyToId && (
          <div style={{ fontSize: 11, color: "#6b7280", borderLeft: "2px solid #cbd5e1", paddingLeft: 6, marginBottom: 2 }}>
            {message.replyToAuthor}: {message.replyToText}
          </div>
        )}
        <strong>{message.author}: </strong>
        <span>{message.text}</span>
      </div>
    </div>
  );
}

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
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
      replyToId: replyTarget?.id,
      replyToAuthor: replyTarget?.author,
      replyToText: replyTarget?.text,
    });
    setText("");
    setReplyTarget(null);
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>ChatApp</h1>
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, minHeight: 240, marginBottom: 12, overflow: "hidden" }}>
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} onReply={setReplyTarget} />
        ))}
      </div>
      {replyTarget && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            background: "#f3f4f6",
            padding: "4px 8px",
            borderRadius: 4,
            marginBottom: 6,
          }}
        >
          <span>
            Replying to <strong>{replyTarget.author}</strong>: {replyTarget.text}
          </span>
          <button onClick={() => setReplyTarget(null)} style={{ border: "none", background: "none", cursor: "pointer" }}>
            ✕
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message (swipe a message left-to-right to reply)"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </main>
  );
}
