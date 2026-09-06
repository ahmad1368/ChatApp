"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";
import ThemeToggle from "./ThemeToggle";
import {
  loadCachedMessages,
  loadQueuedMessages,
  QueuedMessage,
  saveCachedMessages,
  saveQueuedMessages,
} from "./offlineStore";

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

// PushManager.subscribe needs the VAPID public key as a Uint8Array, but the
// server hands it over base64url-encoded.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type WebPushStatus = "unsupported" | "default" | "subscribing" | "subscribed" | "denied";
type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  const additions = incoming.filter((m) => !seen.has(m.id));
  return additions.length ? [...prev, ...additions] : prev;
}

export default function ChatRoom() {
  // Hydrate synchronously from the local cache so there's something on
  // screen immediately, even before the network fetch (or if it never
  // succeeds because we're offline).
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadCachedMessages(DEFAULT_ROOM_ID));
  const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueuedMessages(DEFAULT_ROOM_ID));
  const [text, setText] = useState("");
  const [syncStatus, setSyncStatus] = useState<"connecting" | "synced" | "offline">("connecting");
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  // On a metered/slow connection, don't auto-open the live socket — let the
  // user opt in instead of spending their data budget on a connection they
  // didn't ask for.
  const [liveUpdatesEnabled, setLiveUpdatesEnabled] = useState(() => !prefersReducedData());
  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus>("unsupported");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(
    "unsupported"
  );
  const socketRef = useRef<Socket | null>(null);
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const authorRef = useRef(author);
  authorRef.current = author;
  // Tracks the newest message timestamp we've seen locally so that on
  // reconnect (dropped wifi, backgrounded tab, another device catching up)
  // we only fetch what we missed instead of the whole history again.
  const lastSyncedAtRef = useRef<string | undefined>(undefined);

  const syncSince = (since?: string) =>
    fetch(`${API_URL}/api/rooms/${DEFAULT_ROOM_ID}/messages${since ? `?since=${encodeURIComponent(since)}` : ""}`)
      .then((res) => res.json())
      .then((incoming: ChatMessage[]) => {
        if (incoming.length) {
          lastSyncedAtRef.current = incoming[incoming.length - 1].createdAt;
        }
        setMessages((prev) => (since ? mergeMessages(prev, incoming) : incoming));
        setSyncStatus("synced");
      })
      .catch(() => setSyncStatus("offline"));

  useEffect(() => {
    saveCachedMessages(DEFAULT_ROOM_ID, messages);
  }, [messages]);

  useEffect(() => {
    saveQueuedMessages(DEFAULT_ROOM_ID, queue);
  }, [queue]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission as NotificationPermissionState);
    }

    // PwaRegister (see layout.tsx) already registers "/sw.js"; wait for that
    // registration to check whether a push subscription already exists.
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    if (!supported) return;

    navigator.serviceWorker.ready.then(async (registration) => {
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

  // Always load the room's history on mount, even if live updates are
  // paused for Data Saver below — pausing only skips the live socket.
  useEffect(() => {
    syncSince();
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

    const flushQueue = () => {
      for (const queued of queueRef.current) {
        socket.emit("message:send", { roomId: DEFAULT_ROOM_ID, author: queued.author, text: queued.text });
      }
      setQueue([]);
    };

    socket.on("connect", () => {
      socket.emit("join", DEFAULT_ROOM_ID);
      // Reconnect sync: catch up on anything sent while we were disconnected.
      syncSince(lastSyncedAtRef.current);
      flushQueue();
    });
    socket.on("disconnect", () => setSyncStatus("offline"));
    socket.on("message:new", (message: ChatMessage) => {
      lastSyncedAtRef.current = message.createdAt;
      setMessages((prev) => mergeMessages(prev, [message]));
      // The queued entry is now confirmed by the server's own broadcast.
      setQueue((prev) => prev.filter((q) => !(q.author === message.author && q.text === message.text)));

      // Mirrors mobile push notifications for the web: alert the user about
      // new messages while the tab is backgrounded, without needing a push
      // server (see Web Push, tracked separately, for closed-tab delivery).
      const isOwnMessage = message.author === authorRef.current;
      const canNotify = "Notification" in window && Notification.permission === "granted";
      if (!isOwnMessage && document.hidden && canNotify) {
        new Notification(message.author, { body: message.text, tag: DEFAULT_ROOM_ID });
      }
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

    // The browser's connectivity events fire faster than socket.io's own
    // reconnect backoff in some cases (e.g. coming back from airplane
    // mode) — nudge it to retry immediately instead of waiting.
    const handleOnline = () => {
      if (!socket.connected) socket.connect();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      clearHiddenTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      socket.disconnect();
    };
  }, [liveUpdatesEnabled]);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result as NotificationPermissionState);
  };

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
    <main className="chat-app">
      <div className="chat-app__header">
        <h1>ChatApp</h1>
        <div className="chat-app__header-links">
          <Link href={`/privacy?author=${encodeURIComponent(author)}`}>Privacy</Link>
          <Link href={`/privacy/export?author=${encodeURIComponent(author)}`}>Download my data</Link>
          <Link href={`/privacy/location?author=${encodeURIComponent(author)}`}>Location privacy</Link>
          <ThemeToggle />
        </div>
      </div>
      {liveUpdatesEnabled ? (
        <p
          role="status"
          className={`chat-app__status${syncStatus === "offline" ? " chat-app__status--offline" : ""}`}
        >
          {syncStatus === "connecting" && "Connecting…"}
          {syncStatus === "synced" && "Synced"}
          {syncStatus === "offline" && "Offline — reconnecting…"}
        </p>
      ) : (
        <p role="status" className="chat-app__status">
          Data Saver detected — live updates are paused.{" "}
          <button className="chat-app__link-button" onClick={() => setLiveUpdatesEnabled(true)}>
            Enable live chat
          </button>
        </p>
      )}
      {(webPushStatus === "default" || webPushStatus === "subscribing" || webPushStatus === "denied") && (
        <button
          className="chat-app__notify-button"
          onClick={enableWebPush}
          disabled={webPushStatus === "subscribing" || webPushStatus === "denied"}
        >
          {webPushStatus === "subscribing" && "Enabling…"}
          {webPushStatus === "denied" && "Push notifications blocked (enable in browser settings)"}
          {webPushStatus === "default" && "Enable push notifications"}
        </button>
      )}
      {notificationPermission !== "unsupported" && notificationPermission !== "granted" && (
        <button
          className="chat-app__notify-button"
          onClick={requestNotificationPermission}
          disabled={notificationPermission === "denied"}
        >
          {notificationPermission === "denied"
            ? "Notifications blocked (enable in browser settings)"
            : "Enable message notifications"}
        </button>
      )}
      <div className="chat-app__messages">
        {messages.map((m) => (
          <div key={m.id} className="chat-app__message">
            <strong>{m.author}: </strong>
            <span>{m.text}</span>
          </div>
        ))}
        {queue.map((q) => (
          <div key={q.clientId} className="chat-app__message chat-app__message--queued">
            <strong>{q.author}: </strong>
            <span>{q.text}</span>
            <em className="chat-app__queued-tag">(queued)</em>
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
          disabled={!liveUpdatesEnabled}
        />
        <button className="chat-app__send" onClick={sendMessage} disabled={!liveUpdatesEnabled}>
          Send
        </button>
      </div>
    </main>
  );
}
