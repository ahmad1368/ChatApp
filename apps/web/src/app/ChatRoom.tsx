"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { ChatMessage, DEFAULT_ROOM_ID } from "@chatapp/shared";
import { loadDataSaverPreference, saveDataSaverPreference } from "./dataSaverStore";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";
import { compressImage } from "./imageCompression";
import { LocaleToggle, useLocale } from "./LocaleProvider";
import ThemeToggle from "./ThemeToggle";
import ReportDialog from "./ReportDialog";
import SOSButton from "./SOSButton";
import BiometricLock from "./BiometricLock";
import { getOrCreateGuestIdentity } from "./guestIdentity";
import {
  loadCachedMessages,
  loadQueuedMessages,
  QueuedMessage,
  saveCachedMessages,
  saveQueuedMessages,
} from "./offlineStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 20;

// Contact Picker API: supported on Chrome for Android only. Where it's missing
// (all desktop browsers, iOS Safari) we fall back to manual number entry as the
// web equivalent of "import phone contacts."
type ContactsManager = {
  select: (properties: string[], options?: { multiple?: boolean }) => Promise<Array<{ tel?: string[] }>>;
};

function getContactsManager(): ContactsManager | undefined {
  return (navigator as unknown as { contacts?: ContactsManager }).contacts;
}
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

function MessageRow({
  message,
  highlighted,
  registerRef,
  onReply,
  onCopyLink,
  onReport,
  onBlock,
  isOwnMessage,
}: {
  message: ChatMessage;
  highlighted: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onReply: (target: ReplyTarget) => void;
  onCopyLink: (messageId: string) => void;
  onReport: (target: { author: string; messageId: string }) => void;
  onBlock: (author: string) => void;
  isOwnMessage: boolean;
}) {
  const { dragX, handlers } = useSwipeToReply(() =>
    onReply({ id: message.id, author: message.author, text: message.text })
  );

  return (
    <div className="chat-app__message-row">
      <div
        className="chat-app__reply-indicator"
        style={{ opacity: Math.min(dragX / SWIPE_TRIGGER_PX, 1) }}
        aria-hidden
      >
        ↩
      </div>
      <div
        ref={registerRef}
        {...handlers}
        className={`chat-app__message${highlighted ? " chat-app__message--highlighted" : ""}`}
        style={{ ...handlers.style, transform: `translateX(${dragX}px)` }}
      >
        {message.replyToId && (
          <div className="chat-app__reply-quote">
            {message.replyToAuthor}: {message.replyToText}
          </div>
        )}
        <strong>{message.author}: </strong>
        {message.imageUrl ? (
          <img src={message.imageUrl} alt="Shared" loading="lazy" className="chat-app__shared-image" />
        ) : (
          <span>{message.text}</span>
        )}
        <button
          className="chat-app__copy-link-button"
          onClick={() => onCopyLink(message.id)}
          title="Copy link to this message"
        >
          🔗
        </button>
        {!isOwnMessage && (
          <button
            className="chat-app__report-button"
            onClick={() => onReport({ author: message.author, messageId: message.id })}
            title="Report this message"
          >
            ⚠
          </button>
        )}
        {!isOwnMessage && (
          <button className="chat-app__report-button" onClick={() => onBlock(message.author)} title={`Block ${message.author}`}>
            🚫
          </button>
        )}
      </div>
    </div>
  );
}

// How long the tab can sit hidden before we drop the live connection to save
// battery/data. Background delivery is still covered by Web Push (see #5);
// this just avoids an idle socket burning power while nobody is looking.
const DISCONNECT_AFTER_HIDDEN_MS = 2 * 60 * 1000;

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

export default function ChatRoom({ roomId = DEFAULT_ROOM_ID, isGuest = false }: { roomId?: string; isGuest?: boolean }) {
  const { t } = useLocale();
  // Hydrate synchronously from the local cache so there's something on
  // screen immediately, even before the network fetch (or if it never
  // succeeds because we're offline).
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadCachedMessages(roomId));
  const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueuedMessages(roomId));
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [syncStatus, setSyncStatus] = useState<"connecting" | "synced" | "offline">("connecting");
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [reportTarget, setReportTarget] = useState<{ author: string; messageId: string } | null>(null);
  const [blockedAuthors, setBlockedAuthors] = useState<string[]>([]);
  const [watermarkLabel, setWatermarkLabel] = useState<string | null>(null);
  const [obscured, setObscured] = useState(false);
  const [albumPhotoIds, setAlbumPhotoIds] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [albumAccessLevel, setAlbumAccessLevel] = useState<"public" | "private" | "requestAccess">("public");
  const [pendingAlbumRequests, setPendingAlbumRequests] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactNumbers, setContactNumbers] = useState("");
  const [contactBlockStatus, setContactBlockStatus] = useState<string | null>(null);
  const [contactPickerSupported, setContactPickerSupported] = useState(false);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Explicit user preference (persisted), defaulting to the OS/browser's
  // Data Saver signal on a metered/slow connection — either way, don't
  // auto-open the live socket; let the user opt in instead of spending
  // their data budget on a connection they didn't ask for.
  const [dataSaverEnabled, setDataSaverEnabled] = useState(() => loadDataSaverPreference());
  // In Data Saver Mode, chat data only loads once the user explicitly asks
  // for it — this flag tracks that manual opt-in for the current session.
  const [manuallyStarted, setManuallyStarted] = useState(false);
  const liveUpdatesEnabled = !dataSaverEnabled || manuallyStarted;
  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus>("unsupported");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(
    "unsupported"
  );
  const socketRef = useRef<Socket | null>(null);
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const authorRef = useRef(author);
  authorRef.current = author;
  // Tracks the newest message timestamp we've seen locally so that on
  // reconnect (dropped wifi, backgrounded tab, another device catching up)
  // we only fetch what we missed instead of the whole history again.
  const lastSyncedAtRef = useRef<string | undefined>(undefined);
  const searchParams = useSearchParams();
  const deepLinkedMessageId = searchParams.get("m");

  // With `since`, fetches only what was missed while disconnected (reconnect
  // catch-up). Without it, fetches just the most recent page — the client
  // shouldn't pay to download the entire room history (and its data cost)
  // just to render the last screenful of messages; loadOlderMessages()
  // below pages further back on demand.
  const syncSince = (since?: string) =>
    fetch(
      `${API_URL}/api/rooms/${roomId}/messages${
        since ? `?since=${encodeURIComponent(since)}` : `?limit=${PAGE_SIZE}`
      }&viewer=${encodeURIComponent(author)}`
    )
      .then((res) => {
        if (!since) setHasMore(res.headers.get("x-has-more") === "true");
        return res.json();
      })
      .then((incoming: ChatMessage[]) => {
        if (incoming.length) {
          lastSyncedAtRef.current = incoming[incoming.length - 1].createdAt;
        }
        setMessages((prev) => (since ? mergeMessages(prev, incoming) : incoming));
        setSyncStatus("synced");
      })
      .catch(() => setSyncStatus("offline"));

  useEffect(() => {
    saveCachedMessages(roomId, messages);
  }, [roomId, messages]);

  useEffect(() => {
    saveQueuedMessages(roomId, queue);
  }, [roomId, queue]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission as NotificationPermissionState);
    }

    // UpdateNotifier (see layout.tsx) already registers "/sw.js"; wait for
    // that registration to check whether a push subscription already exists.
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

  const loadOlderMessages = () => {
    const oldest = messages[0];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    fetch(`${API_URL}/api/rooms/${roomId}/messages?limit=${PAGE_SIZE}&before=${oldest.id}&viewer=${encodeURIComponent(author)}`)
      .then((res) => {
        setHasMore(res.headers.get("x-has-more") === "true");
        return res.json();
      })
      .then((older: ChatMessage[]) => setMessages((prev) => [...older, ...prev]))
      .finally(() => setLoadingMore(false));
  };

  const refreshBlockedAuthors = () => {
    fetch(`${API_URL}/api/blocks/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setBlockedAuthors(body.blockedAuthors ?? []))
      .catch(() => setBlockedAuthors([]));
  };

  const refreshPendingAlbumRequests = () => {
    fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/access-requests`)
      .then((res) => res.json())
      .then((body) => setPendingAlbumRequests(body.pending ?? []))
      .catch(() => setPendingAlbumRequests([]));
  };

  const changeAlbumAccessLevel = async (accessLevel: "public" | "private" | "requestAccess") => {
    const res = await fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/access-level`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessLevel }),
    });
    if (res.ok) {
      setAlbumAccessLevel(accessLevel);
      if (accessLevel === "requestAccess") refreshPendingAlbumRequests();
    }
  };

  const respondToAlbumRequest = async (requester: string, approve: boolean) => {
    await fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/access-requests/${encodeURIComponent(requester)}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    });
    setPendingAlbumRequests((prev) => prev.filter((r) => r !== requester));
  };

  useEffect(() => {
    refreshBlockedAuthors();
    setContactPickerSupported(Boolean(getContactsManager()));
    fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/access-level`)
      .then((res) => res.json())
      .then((body) => {
        setAlbumAccessLevel(body.accessLevel ?? "public");
        if (body.accessLevel === "requestAccess") refreshPendingAlbumRequests();
      })
      .catch(() => undefined);
    fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/photos`)
      .then((res) => res.json())
      .then((body) => setAlbumPhotoIds(body.photoIds ?? []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // No browser API can block or detect an OS-level screenshot, so we deter +
    // trace instead: stamp a per-session code (author + trace code) into a
    // faint on-screen watermark, so a leaked screenshot is traceable.
    fetch(`${API_URL}/api/watermark/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, roomId }),
    })
      .then((res) => res.json())
      .then((session) => setWatermarkLabel(`${session.author} · ${session.traceCode}`))
      .catch(() => setWatermarkLabel(null));

    // Defense-in-depth for screen-sharing/shoulder-surfing: blur chat
    // content whenever the tab isn't the visible, focused one.
    const handleVisibility = () => setObscured(document.hidden);
    const handleBlur = () => setObscured(true);
    const handleFocus = () => setObscured(false);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const blockUser = async (blockedAuthor: string) => {
    if (!confirm(`Block ${blockedAuthor}? You won't see each other's messages anymore.`)) return;
    await fetch(`${API_URL}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: author, blockedAuthor }),
    });
    setBlockedAuthors((prev) => [...prev, blockedAuthor]);
  };

  const unblockUser = async (blockedAuthor: string) => {
    await fetch(`${API_URL}/api/blocks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: author, blockedAuthor }),
    });
    setBlockedAuthors((prev) => prev.filter((a) => a !== blockedAuthor));
  };

  const savePhoneNumber = async () => {
    if (!phoneNumber.trim()) return;
    await fetch(`${API_URL}/api/profile/phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, phoneNumber: phoneNumber.trim() }),
    });
    setContactBlockStatus("Phone number saved.");
  };

  const blockByContactNumbers = async (numbers: string[]) => {
    const res = await fetch(`${API_URL}/api/contacts/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, phoneNumbers: numbers }),
    });
    const body = await res.json();
    const newlyBlocked: string[] = body.blockedAuthors ?? [];
    if (newlyBlocked.length > 0) {
      setBlockedAuthors((prev) => Array.from(new Set([...prev, ...newlyBlocked])));
      setContactBlockStatus(`Blocked ${newlyBlocked.length} contact(s) already on ChatApp.`);
    } else {
      setContactBlockStatus("None of those contacts were found on ChatApp.");
    }
  };

  const blockPastedContacts = () => {
    const numbers = contactNumbers
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (numbers.length === 0) return;
    blockByContactNumbers(numbers);
    setContactNumbers("");
  };

  const pickDeviceContacts = async () => {
    const contactsManager = getContactsManager();
    if (!contactsManager) return;
    try {
      const picked = await contactsManager.select(["tel"], { multiple: true });
      const numbers = picked.flatMap((c) => c.tel ?? []);
      if (numbers.length > 0) blockByContactNumbers(numbers);
    } catch {
      // user cancelled the picker or permission was denied
    }
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

    const uploadRes = await fetch(`${API_URL}/api/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, mimeType: file.type, data: base64 }),
    });
    if (!uploadRes.ok) {
      const body = await uploadRes.json().catch(() => ({}));
      setPhotoError(body.error ?? "Failed to upload photo");
      return;
    }
    const { id } = await uploadRes.json();

    const addRes = await fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: id }),
    });
    if (!addRes.ok) {
      const body = await addRes.json().catch(() => ({}));
      setPhotoError(body.error ?? "Failed to add photo to album");
      return;
    }
    const { photoIds } = await addRes.json();
    setAlbumPhotoIds(photoIds);
  };

  const removeAlbumPhoto = async (photoId: string) => {
    const res = await fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/photos/${photoId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const { photoIds } = await res.json();
      setAlbumPhotoIds(photoIds);
    }
  };

  // The server also filters blocked authors out of the initial/paginated
  // REST fetch (see `viewer=` above), but a live message:new delivered over
  // the socket bypasses that — this app broadcasts to the whole room rather
  // than filtering per-socket (doing so would break #20's Redis-backed
  // multi-instance delivery), so the client is the one place that can
  // reliably keep a blocked author out of view for every message path.
  const visibleMessages = messages.filter((m) => !blockedAuthors.includes(m.author));

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

  // Always load the room's history on mount (and whenever roomId changes),
  // even if live updates are paused for Data Saver below — pausing only
  // skips the live socket.
  useEffect(() => {
    syncSince();
  }, [roomId]);

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
        socket.emit("message:send", { roomId, author: queued.author, text: queued.text });
      }
      setQueue([]);
    };

    socket.on("connect", () => {
      socket.emit("join", roomId);
      // Reconnect sync: catch up on anything sent while we were disconnected.
      syncSince(lastSyncedAtRef.current);
      flushQueue();
    });
    socket.on("disconnect", () => setSyncStatus("offline"));
    socket.on("message:new", (message: ChatMessage) => {
      if (message.roomId !== roomId) return;
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
        new Notification(message.author, { body: message.text, tag: roomId });
      }
    });
    socket.on("message:rejected", (payload: { reason?: string }) => {
      if (payload?.reason === "scam_content") {
        setImageError("That message looks like it violates ChatApp's policy against financial and crypto scams, so it wasn't sent.");
      } else if (payload?.reason === "rate_limited") {
        setImageError("You're sending messages too quickly. Please wait a moment and try again.");
      } else if (payload?.reason === "guest_mode") {
        setImageError("Guests can't send messages — sign up to chat.");
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
  }, [liveUpdatesEnabled, roomId]);

  // Deep link support: jump to and briefly highlight a specific message
  // (e.g. from a shared /room/<id>?m=<messageId> link) once it's rendered.
  useEffect(() => {
    if (!deepLinkedMessageId) return;
    const el = messageRefs.current.get(deepLinkedMessageId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(deepLinkedMessageId);
    const timeout = setTimeout(() => setHighlightedId(null), 2500);
    return () => clearTimeout(timeout);
  }, [deepLinkedMessageId, messages]);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result as NotificationPermissionState);
  };

  const sendMessage = () => {
    if (isGuest) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");

    if (socketRef.current?.connected) {
      socketRef.current.emit("message:send", {
        roomId,
        author,
        text: trimmed,
        replyToId: replyTarget?.id,
        replyToAuthor: replyTarget?.author,
        replyToText: replyTarget?.text,
        asGuest: isGuest,
      });
      setReplyTarget(null);
      return;
    }

    // Offline (or still connecting): hold the message locally and send it
    // once the socket reconnects instead of dropping it.
    setQueue((prev) => [
      ...prev,
      { clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, author, text: trimmed, queuedAt: new Date().toISOString() },
    ]);
    setReplyTarget(null);
  };

  const copyMessageLink = (messageId: string) => {
    const url = `${window.location.origin}/room/${roomId}?m=${messageId}`;
    navigator.clipboard?.writeText(url).catch(() => {
      // Clipboard API unavailable/denied — link is still shareable manually via the URL bar.
    });
  };

  const sendImage = async (file: File) => {
    if (isGuest) return;
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
        roomId,
        author,
        text: "",
        imageUrl: `${API_URL}${url}`,
        asGuest: isGuest,
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

  // Global shortcuts: Ctrl/Cmd+K works even while typing elsewhere; `?` is
  // only treated as a shortcut when the user isn't actively typing a message.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        composerRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
        composerRef.current?.blur();
        return;
      }
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <BiometricLock author={author}>
    <main className="chat-app">
      <div className="chat-app__header">
        <h1>{t("title")}</h1>
        <div className="chat-app__header-links">
          <Link href={`/privacy?author=${encodeURIComponent(author)}`}>Privacy</Link>
          <Link href={`/privacy/export?author=${encodeURIComponent(author)}`}>Download my data</Link>
          <Link href={`/privacy/location?author=${encodeURIComponent(author)}`}>Location privacy</Link>
          <Link href="/safety">🛡️ Safety Center</Link>
          <Link href="/share-my-date">📍 Share My Date</Link>
          <ThemeToggle />
          <LocaleToggle />
          <button className="chat-app__theme-toggle" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)">
            ⌨ Shortcuts
          </button>
          <label className="chat-app__data-saver-toggle">
            <input type="checkbox" checked={dataSaverEnabled} onChange={toggleDataSaver} />
            Data Saver Mode
          </label>
        </div>
      </div>
      <SOSButton author={author} />
      {imageError && <p className="chat-app__status chat-app__status--offline">{imageError}</p>}
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
        <div className="chat-app__data-saver-banner">
          Data Saver Mode is on — the chat won&apos;t load messages or open a live connection until you ask it to.
          <div>
            <button className="chat-app__send" onClick={() => setManuallyStarted(true)}>
              Load chat
            </button>
          </div>
        </div>
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
      <div
        className="chat-app__messages"
        style={{ position: "relative", filter: obscured ? "blur(12px)" : "none", transition: "filter 120ms ease" }}
      >
        {watermarkLabel && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              display: "flex",
              flexWrap: "wrap",
              alignContent: "space-around",
              justifyContent: "space-around",
              opacity: 0.12,
              fontSize: 12,
              transform: "rotate(-20deg)",
              userSelect: "none",
            }}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i}>{watermarkLabel}</span>
            ))}
          </div>
        )}
        {hasMore && (
          <button className="chat-app__load-more-button" onClick={loadOlderMessages} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load older messages"}
          </button>
        )}
        {visibleMessages.map((m) => (
          <MessageRow
            key={m.id}
            message={m}
            highlighted={highlightedId === m.id}
            registerRef={(el) => {
              if (el) messageRefs.current.set(m.id, el);
              else messageRefs.current.delete(m.id);
            }}
            onReply={setReplyTarget}
            onCopyLink={copyMessageLink}
            onReport={setReportTarget}
            onBlock={blockUser}
            isOwnMessage={m.author === author}
          />
        ))}
        {queue.map((q) => (
          <div key={q.clientId} className="chat-app__message chat-app__message--queued">
            <strong>{q.author}: </strong>
            <span>{q.text}</span>
            <em className="chat-app__queued-tag">(queued)</em>
          </div>
        ))}
        {isSendingImage && <p className="chat-app__status">Compressing and sending image…</p>}
      </div>
      {replyTarget && (
        <div className="chat-app__reply-banner">
          <span>
            Replying to <strong>{replyTarget.author}</strong>: {replyTarget.text}
          </span>
          <button className="chat-app__link-button" onClick={() => setReplyTarget(null)}>
            ✕
          </button>
        </div>
      )}
      {isGuest && (
        <div className="chat-app__guest-banner">
          You're browsing as a guest — you can read messages, but{" "}
          <a href="/signup">sign up</a> to send your own.
        </div>
      )}
      <div className="chat-app__composer">
        <textarea
          ref={composerRef}
          className="chat-app__input chat-app__input--textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={isGuest ? "Sign up to send a message" : t("placeholder")}
          disabled={isGuest || !liveUpdatesEnabled}
          rows={1}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="chat-app__file-input"
        />
        <button
          className="chat-app__image-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isGuest || isSendingImage || !liveUpdatesEnabled}
          title="Send an image"
        >
          📷
        </button>
        <button className="chat-app__send" onClick={sendMessage} disabled={isGuest || !liveUpdatesEnabled}>
          {t("send")}
        </button>
      </div>
      {blockedAuthors.length > 0 && (
        <div className="chat-app__guest-banner">
          <strong>Blocked users:</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
            {blockedAuthors.map((blockedAuthor) => (
              <li key={blockedAuthor}>
                {blockedAuthor}{" "}
                <button className="chat-app__link-button" onClick={() => unblockUser(blockedAuthor)}>
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
        <h2 style={{ fontSize: 14 }}>Block phone contacts</h2>
        <p style={{ color: "var(--color-muted)" }}>
          Save your number so people who have you saved can find you, then block any of your phone
          contacts who are already on ChatApp.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Your phone number"
            style={{ flex: 1, padding: 6 }}
          />
          <button onClick={savePhoneNumber}>Save</button>
        </div>

        {contactPickerSupported ? (
          <button onClick={pickDeviceContacts}>Import contacts to block</button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <textarea
              value={contactNumbers}
              onChange={(e) => setContactNumbers(e.target.value)}
              placeholder="Paste contact phone numbers, one per line"
              rows={3}
              style={{ padding: 6 }}
            />
            <button onClick={blockPastedContacts} style={{ alignSelf: "flex-start" }}>
              Block matching contacts
            </button>
          </div>
        )}
        {contactBlockStatus && <p style={{ color: "var(--color-muted)" }}>{contactBlockStatus}</p>}
      </section>
      <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
        <h2 style={{ fontSize: 14 }}>Photo album ({albumPhotoIds.length}/9)</h2>
        <p style={{ color: "var(--color-muted)" }}>
          Uploaded photos are watermarked with your name every time they&apos;re served, to deter
          photo theft — the watermark is burned into the image itself, not just shown on top of it.
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={albumPhotoIds.length >= 9}
          onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
        />
        {albumPhotoIds.length >= 9 && (
          <p style={{ color: "var(--color-muted)" }}>Your album is full — remove a photo to add another.</p>
        )}
        {photoError && <p style={{ color: "var(--color-danger)" }}>{photoError}</p>}
        {albumPhotoIds.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
            {albumPhotoIds.map((id) => (
              <div key={id} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_URL}/api/photos/${id}?viewer=${encodeURIComponent(author)}`}
                  alt="Watermarked upload"
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }}
                />
                <button
                  onClick={() => removeAlbumPhoto(id)}
                  title="Remove photo"
                  style={{ position: "absolute", top: 4, right: 4, padding: "2px 6px" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>Album access</label>
          <select
            value={albumAccessLevel}
            onChange={(e) => changeAlbumAccessLevel(e.target.value as "public" | "private" | "requestAccess")}
            style={{ padding: 6 }}
          >
            <option value="public">Public — anyone can view</option>
            <option value="private">Private — only me</option>
            <option value="requestAccess">Request access — approve each viewer</option>
          </select>
          {albumAccessLevel === "requestAccess" && (
            <div style={{ marginTop: 8 }}>
              {pendingAlbumRequests.length === 0 && <p style={{ color: "var(--color-muted)" }}>No pending requests.</p>}
              {pendingAlbumRequests.map((requester) => (
                <div key={requester} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span>{requester} wants access</span>
                  <button onClick={() => respondToAlbumRequest(requester, true)}>Approve</button>
                  <button onClick={() => respondToAlbumRequest(requester, false)}>Deny</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {showShortcuts && <KeyboardShortcutsHelp onClose={() => setShowShortcuts(false)} />}
      {reportTarget && (
        <ReportDialog
          reporterAuthor={author}
          reportedAuthor={reportTarget.author}
          messageId={reportTarget.messageId}
          onClose={() => setReportTarget(null)}
        />
      )}
    </main>
    </BiometricLock>
  );
}
