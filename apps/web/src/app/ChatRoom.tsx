"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import {
  ChatMessage,
  DEFAULT_ROOM_ID,
  DATE_PROPOSAL_CATEGORIES,
  DATE_PROPOSAL_LABELS,
  DateProposalCategory,
  SendMessagePayload,
  EncryptedPayload,
} from "@chatapp/shared";
import { getOrCreateKeyPair, exportPublicKeyJwk, deriveSharedKey, encryptText, decryptText } from "./e2ee";
import { loadDataSaverPreference, saveDataSaverPreference } from "./dataSaverStore";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";
import { compressImage, blobToBase64 } from "./imageCompression";
import { computeWaveform } from "./voiceNoteWaveform";
import GifPicker from "./GifPicker";
import LocationPicker, { LocationSharePayload } from "./LocationPicker";
import DateInvitePicker, { DateInviteSharePayload } from "./DateInvitePicker";
import { applyBeautyFilter, applyBackgroundBlur } from "./beautyFilter";
import IcebreakerSuggestions from "./IcebreakerSuggestions";
import LocationMessage from "./LocationMessage";
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

/**
 * Bumble/Snapchat-style "view once, then gone" chat photo (#123): gated
 * behind an explicit tap rather than loading immediately on message
 * arrival — auto-loading would consume the one-time view before the
 * recipient ever chose to look. `viewer` is this browser's own identity;
 * the server (selfDestructPhotos.ts) never destroys it for the original
 * sender, so tapping your own sent photo is always safe to repeat.
 */
function SelfDestructPhoto({ url, viewer }: { url: string; viewer: string }) {
  const [revealed, setRevealed] = useState(false);
  const [gone, setGone] = useState(false);

  if (gone) {
    return <p className="chat-app__self-destruct-gone">🔥 This photo has disappeared</p>;
  }
  if (!revealed) {
    return (
      <button className="chat-app__self-destruct-reveal" onClick={() => setRevealed(true)}>
        🔥 Tap to view — disappears after viewing
      </button>
    );
  }
  return (
    <img
      src={`${url}?viewer=${encodeURIComponent(viewer)}`}
      alt="Disappearing"
      className="chat-app__shared-image"
      onError={() => setGone(true)}
    />
  );
}

/**
 * Feeld's real optional end-to-end encrypted chat (#149): decrypts
 * client-side with the already-derived shared AES key (see e2ee.ts) —
 * there's no server endpoint to ask for plaintext, because the server
 * never has it. Shown as a locked placeholder while no key is available
 * yet (e.g. this browser reloaded and hasn't re-derived the shared key)
 * or if decryption fails (wrong/rotated key).
 */
function EncryptedMessage({ payload, sharedKey }: { payload: EncryptedPayload; sharedKey: CryptoKey | null }) {
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPlaintext(null);
    setFailed(false);
    if (!sharedKey) return;
    let cancelled = false;
    decryptText(sharedKey, payload)
      .then((text) => {
        if (!cancelled) setPlaintext(text);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.ciphertext, payload.iv, sharedKey]);

  if (plaintext !== null) {
    return <span className="chat-app__encrypted-message">🔒 {plaintext}</span>;
  }
  return (
    <em className="chat-app__encrypted-message chat-app__encrypted-message--locked">
      {failed ? "🔒 Couldn't decrypt this message" : "🔒 Encrypted message"}
    </em>
  );
}

/**
 * Snapchat/Bumble's real "play a mini-game within chat to break the ice"
 * (#148): a genuinely playable Tic-Tac-Toe board attached to the message
 * that started the game (see server.ts's game:move for the authoritative
 * turn/win validation this only mirrors for the UI).
 */
function TicTacToeBoard({
  game,
  viewer,
  onMove,
}: {
  game: NonNullable<ChatMessage["game"]>;
  viewer: string;
  onMove: (cellIndex: number) => void;
}) {
  const isViewerTurn = (game.turn === "X" ? game.playerX : game.playerO) === viewer;
  return (
    <div className="chat-app__tic-tac-toe">
      <div className="chat-app__tic-tac-toe-grid">
        {game.board.map((cell, i) => (
          <button
            key={i}
            className="chat-app__tic-tac-toe-cell"
            onClick={() => onMove(i)}
            disabled={Boolean(cell) || Boolean(game.winner) || !isViewerTurn}
          >
            {cell ?? ""}
          </button>
        ))}
      </div>
      <p className="chat-app__tic-tac-toe-status">
        {game.winner === "draw"
          ? "It's a draw!"
          : game.winner
          ? `${game.winner} wins!`
          : isViewerTurn
          ? "Your turn"
          : "Waiting for opponent…"}
      </p>
    </div>
  );
}

/**
 * Bumble's real "send a date invitation within chat" (#146): a card
 * instead of plain text, so the recipient can act on it (Accept/Decline)
 * rather than just read it. The sender sees their own proposal's status
 * update live once the recipient responds (see ChatRoom.tsx's
 * date-invite:updated listener) — no action for them once sent.
 */
function DateInviteCard({
  dateInvite,
  isOwnMessage,
  onRespond,
}: {
  dateInvite: NonNullable<ChatMessage["dateInvite"]>;
  isOwnMessage: boolean;
  onRespond: (response: "accepted" | "declined") => void;
}) {
  const proposedAt = new Date(dateInvite.proposedAt);
  return (
    <div className="chat-app__date-invite">
      <p className="chat-app__date-invite-title">📅 Date invitation</p>
      <p>{dateInvite.location}</p>
      <p>{proposedAt.toLocaleString()}</p>
      {dateInvite.note && <p className="chat-app__date-invite-note">{dateInvite.note}</p>}
      {dateInvite.status === "pending" && !isOwnMessage && (
        <div className="chat-app__date-invite-actions">
          <button onClick={() => onRespond("accepted")}>Accept</button>
          <button onClick={() => onRespond("declined")}>Decline</button>
        </div>
      )}
      {dateInvite.status === "pending" && isOwnMessage && (
        <p className="chat-app__date-invite-status">Waiting for a response…</p>
      )}
      {dateInvite.status === "accepted" && <p className="chat-app__date-invite-status">✅ Accepted</p>}
      {dateInvite.status === "declined" && <p className="chat-app__date-invite-status">❌ Declined</p>}
    </div>
  );
}

/**
 * Bumble's real "See translation" (#145): on-demand per message, into the
 * viewer's own current app language (see LocaleProvider.tsx's "en"/"fa"
 * toggle from #9) rather than a background bulk-translate of the whole
 * conversation — the server proxies a real Google Cloud Translation API
 * call (translation.ts), so this is a network round trip, not instant.
 */
function TranslateButton({ text }: { text: string }) {
  const { locale } = useLocale();
  const [translated, setTranslated] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (shown) {
      setShown(false);
      return;
    }
    if (translated) {
      setShown(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang: locale }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : "Translation failed");
        return;
      }
      setTranslated(body.translated);
      setShown(true);
    } catch {
      setError("Translation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="chat-app__report-button" onClick={toggle} title="Translate this message" disabled={loading}>
        🌐
      </button>
      {loading && <p className="chat-app__translation">Translating…</p>}
      {shown && translated && <p className="chat-app__translation">{translated}</p>}
      {error && <p className="chat-app__translation chat-app__translation--error">{error}</p>}
    </>
  );
}

/**
 * Bumble's real "Private Detector" AI photo warning (#144): unlike
 * #123's SelfDestructPhoto (destroyed after viewing), this photo is
 * still permanently viewable — it's just blurred behind an explicit tap
 * so the recipient isn't ambushed by it the moment the message arrives.
 */
function SuspiciousPhoto({ url }: { url: string }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return <img src={url} alt="Shared" loading="lazy" className="chat-app__shared-image" />;
  }
  return (
    <button className="chat-app__suspicious-photo-reveal" onClick={() => setRevealed(true)}>
      ⚠️ This photo was flagged as potentially inappropriate — tap to view
    </button>
  );
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
  viewer,
  status,
  liveLocationUpdate,
  isEditing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  sharedKey,
  onGameMove,
  onRespondDateInvite,
}: {
  message: ChatMessage;
  highlighted: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onReply: (target: ReplyTarget) => void;
  onCopyLink: (messageId: string) => void;
  onReport: (target: { author: string; messageId: string }) => void;
  onBlock: (author: string) => void;
  isOwnMessage: boolean;
  viewer: string;
  status?: string;
  liveLocationUpdate?: { latitude: number; longitude: number };
  isEditing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onStartEdit: (message: ChatMessage) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (messageId: string) => void;
  sharedKey: CryptoKey | null;
  onGameMove: (messageId: string, cellIndex: number) => void;
  onRespondDateInvite: (messageId: string, response: "accepted" | "declined") => void;
}) {
  // Mirrors messageEditing.ts/messageDeletion.ts's rules loosely for the
  // UI — the server is the actual source of truth and re-checks all of
  // this on message:edit/message:delete.
  const isPlainTextMessage =
    !message.location &&
    !message.selfDestructImageUrl &&
    !message.audioUrl &&
    !message.imageUrl &&
    !message.encrypted &&
    !message.game &&
    !message.dateProposalCategory &&
    !message.dateInvite;
  const messageAgeMs = Date.now() - new Date(message.createdAt).getTime();
  const canEdit = isOwnMessage && isPlainTextMessage && messageAgeMs < 15 * 60 * 1000;
  const canDelete = isOwnMessage && !message.deleted && messageAgeMs < 24 * 60 * 60 * 1000;
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
        {message.deleted ? (
          <em className="chat-app__deleted-message">🚫 This message was deleted</em>
        ) : message.encrypted ? (
          <EncryptedMessage payload={message.encrypted} sharedKey={sharedKey} />
        ) : message.game ? (
          <TicTacToeBoard game={message.game} viewer={viewer} onMove={(cellIndex) => onGameMove(message.id, cellIndex)} />
        ) : message.dateInvite ? (
          <DateInviteCard
            dateInvite={message.dateInvite}
            isOwnMessage={isOwnMessage}
            onRespond={(response) => onRespondDateInvite(message.id, response)}
          />
        ) : message.location ? (
          <LocationMessage location={message.location} liveUpdate={liveLocationUpdate} />
        ) : message.selfDestructImageUrl ? (
          <SelfDestructPhoto url={message.selfDestructImageUrl} viewer={viewer} />
        ) : message.audioUrl ? (
          <div className="chat-app__voice-note">
            {message.waveform && message.waveform.length > 0 && (
              <div className="chat-app__waveform" aria-hidden>
                {message.waveform.map((peak, i) => (
                  <div key={i} className="chat-app__waveform-bar" style={{ height: `${Math.max(10, peak * 100)}%` }} />
                ))}
              </div>
            )}
            <audio controls src={message.audioUrl} />
          </div>
        ) : message.imageUrl ? (
          message.suspicious ? (
            <SuspiciousPhoto url={message.imageUrl} />
          ) : (
            <img src={message.imageUrl} alt="Shared" loading="lazy" className="chat-app__shared-image" />
          )
        ) : message.dateProposalCategory ? (
          <span className="chat-app__date-proposal">{message.text}</span>
        ) : isEditing ? (
          <span className="chat-app__edit-box">
            <input
              type="text"
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              autoFocus
              className="chat-app__input"
            />
            <button onClick={onSaveEdit}>Save</button>
            <button onClick={onCancelEdit}>Cancel</button>
          </span>
        ) : (
          <span>
            {message.text}
            {message.edited && <em className="chat-app__edited-tag"> (edited)</em>}
          </span>
        )}
        <button
          className="chat-app__copy-link-button"
          onClick={() => onCopyLink(message.id)}
          title="Copy link to this message"
        >
          🔗
        </button>
        {canEdit && !isEditing && (
          <button className="chat-app__copy-link-button" onClick={() => onStartEdit(message)} title="Edit this message">
            ✏️
          </button>
        )}
        {canDelete && (
          <button className="chat-app__copy-link-button" onClick={() => onDelete(message.id)} title="Delete for everyone">
            🗑️
          </button>
        )}
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
        {isPlainTextMessage && !message.deleted && message.text && <TranslateButton text={message.text} />}
        {isOwnMessage && (
          <span
            className={`chat-app__message-status${status === "read" ? " chat-app__message-status--read" : ""}`}
            title={status === "read" ? "Read" : status === "delivered" ? "Delivered" : "Sent"}
          >
            {status === "read" || status === "delivered" ? "✓✓" : "✓"}
          </span>
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

export default function ChatRoom({
  roomId = DEFAULT_ROOM_ID,
  isGuest = false,
  recipient,
}: {
  roomId?: string;
  isGuest?: boolean;
  // Bumble's real "women message first" rule (#135): the other person in
  // a fresh 1:1 match, so the server can enforce the rule on the very
  // first message. This app's rooms have no formal "these two people
  // only" concept yet — #100's matches list still links into one shared
  // room rather than a per-match room (see matches/page.tsx) — so no
  // current caller passes this; it's here so a future per-match room can
  // without needing any more server work.
  recipient?: string;
}) {
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
  // Bumble's real "edit a sent message" (#133) — see messageEditing.ts
  // for the sender-only/15-minute-window/text-only-message rules the
  // server enforces; the UI just optimistically clears editing state on
  // submit and surfaces an error if the server rejects it.
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  // Bumble's real AI "unkind message" warning (#143): holds the message
  // the server flagged so the composer can offer "Edit" (restores the
  // text) or "Send anyway" (re-emits the same payload with
  // overrideWarning: true) rather than silently dropping it.
  const [pendingWarning, setPendingWarning] = useState<{ payload: SendMessagePayload; reason?: string } | null>(null);
  const lastSendPayloadRef = useRef<SendMessagePayload | null>(null);
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
  const [isSendingSelfDestructPhoto, setIsSendingSelfDestructPhoto] = useState(false);
  const [selfDestructError, setSelfDestructError] = useState<string | null>(null);
  const selfDestructFileInputRef = useRef<HTMLInputElement | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  // WhatsApp/Bumble's real "send live or text location" (#127).
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  // Feeld's real optional end-to-end encrypted chat (#149) — see e2ee.ts.
  // `sharedKey` lives in state (not a ref) so MessageRow's decryption
  // effect re-runs once it's derived, not just on the next unrelated render.
  const [e2eeEnabled, setE2eeEnabled] = useState(false);
  const [e2eeBusy, setE2eeBusy] = useState(false);
  const [e2eeError, setE2eeError] = useState<string | null>(null);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [showDateProposalPicker, setShowDateProposalPicker] = useState(false);
  const [showDateInvitePicker, setShowDateInvitePicker] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [liveLocationUpdates, setLiveLocationUpdates] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const liveShareRef = useRef<{ messageId: string; expiresAt: string; intervalId: ReturnType<typeof setInterval> } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSendingVoiceNote, setIsSendingVoiceNote] = useState(false);
  const [voiceNoteError, setVoiceNoteError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
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
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // Bumble's real sent/delivered/read message status (#125) — keyed by
  // message id, populated from the live message:status broadcast.
  const [messageStatuses, setMessageStatuses] = useState<Record<string, string>>({});
  // Bumble's real typing indicator (#126) — who else is typing in this
  // room right now, from the live typing:update broadcast.
  const [typingAuthors, setTypingAuthors] = useState<string[]>([]);
  const isTypingRef = useRef(false);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Badoo's real in-app audio/video call (#128, extended to video by
  // #129) — WebRTC signaling relayed over this same socket/room; see
  // calls.ts for the server-side state machine (identical for both call
  // types — only the `video` flag and this client's getUserMedia
  // constraints/rendering differ). STUN-only (no TURN server configured
  // anywhere in this app's infra), so a call between two peers both
  // behind restrictive/symmetric NATs can fail to connect — an honest,
  // disclosed limitation.
  type CallInfo = { id: string; caller: string; callee: string; video: boolean };
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing" | "active">("idle");
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  // Bumble's real "mandatory text-first" video-call gate (#130) — lets the
  // button show how many more messages are needed instead of a dead click.
  const [videoCallEligibility, setVideoCallEligibility] = useState<{ eligible: boolean; messagesExchanged: number; required: number } | null>(
    null
  );
  const activeCallRef = useRef<CallInfo | null>(null);
  activeCallRef.current = activeCall;
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  // Badoo's real beauty filter/background blur during video calls (#131)
  // — persisted preference; see beautyFilter.ts for the actual client-
  // side processing applied when a call starts.
  const [beautyFilterEnabled, setBeautyFilterEnabled] = useState(false);
  const [backgroundBlurEnabled, setBackgroundBlurEnabled] = useState(false);
  const [backgroundBlurUnsupported, setBackgroundBlurUnsupported] = useState(false);
  const beautyFilterCleanupRef = useRef<(() => void) | null>(null);
  // Tracks the newest message timestamp we've seen locally so that on
  // reconnect (dropped wifi, backgrounded tab, another device catching up)
  // we only fetch what we missed instead of the whole history again.
  const lastSyncedAtRef = useRef<string | undefined>(undefined);
  const searchParams = useSearchParams();
  const deepLinkedMessageId = searchParams.get("m");
  // Bumble's real "Search within conversation text" (#140).
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  // Drag-and-drop reordering: reorder optimistically so the grid feels
  // instant, then persist — on failure (e.g. a concurrent edit elsewhere)
  // refetch the server's order rather than leaving the UI out of sync.
  const reorderAlbumPhoto = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const current = albumPhotoIds;
    const withoutDragged = current.filter((id) => id !== draggedId);
    const targetIndex = withoutDragged.indexOf(targetId);
    const reordered = [
      ...withoutDragged.slice(0, targetIndex),
      draggedId,
      ...withoutDragged.slice(targetIndex),
    ];
    setAlbumPhotoIds(reordered);

    const res = await fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/photos/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: reordered }),
    });
    if (!res.ok) {
      const listRes = await fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/photos`);
      const body = await listRes.json().catch(() => undefined);
      setAlbumPhotoIds(body?.photoIds ?? current);
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
      // Announce identity for #110's live online/last-active indicator —
      // see server.ts's presence:online handler and presence.ts for why
      // this only affects presence once per connection, not once per join.
      socket.emit("presence:online", authorRef.current);
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

      // Bumble's real sent/delivered/read message status (#125): this
      // client having received message:new at all *is* delivery; if the
      // tab is also visible right now, treat that as having been seen too
      // — a coarser trigger than per-message viewport visibility, but
      // consistent with this app's other simplicity-over-precision calls.
      if (!isOwnMessage) {
        socket.emit("message:delivered", { roomId, messageId: message.id, author: authorRef.current });
        if (!document.hidden) {
          socket.emit("message:read", { roomId, messageId: message.id, author: authorRef.current });
        }
      }

      // #127: this is the server's authoritative echo of a live share we
      // just started — only now do we know its message id, so tracking
      // starts here rather than at send time.
      if (isOwnMessage && message.location?.live && message.location.expiresAt) {
        startLiveShareTracking(message.id, message.location.expiresAt);
      }
    });
    socket.on("message:status", ({ messageId, status }: { messageId: string; status: string }) => {
      setMessageStatuses((prev) => ({ ...prev, [messageId]: status }));
    });
    // Bumble's real "edit a sent message" (#133) — mergeMessages() below
    // only ever appends by id, so an existing message's text needs its
    // own update path here rather than going through that.
    socket.on("message:edited", ({ messageId, text, edited }: { messageId: string; text: string; edited: boolean }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text, edited } : m)));
    });
    socket.on("message:edit-rejected", ({ error }: { messageId: string; error: string }) => {
      setEditError(error);
    });
    // Snapchat/Bumble's real "play a mini-game within chat" (#148) — each
    // move lands here for both players, same "server owns the derived
    // truth, client just reflects it" shape as message:edited above.
    socket.on("game:updated", ({ messageId, game }: { messageId: string; game: ChatMessage["game"] }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, game } : m)));
    });
    socket.on("game:rejected", ({ error }: { messageId: string; error: string }) => {
      setEditError(error);
    });
    // WhatsApp/Bumble's real "Delete for Everyone" (#134).
    socket.on("message:deleted", ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, deleted: true, text: "", imageUrl: undefined, audioUrl: undefined, waveform: undefined, selfDestructImageUrl: undefined, location: undefined }
            : m
        )
      );
    });
    // Bumble's real "send a date invitation within chat" (#146): the
    // recipient's accept/decline lands here for both sides (broadcast to
    // the room), same "server owns the derived truth, client just
    // reflects it" shape as message:edited above.
    socket.on(
      "date-invite:updated",
      ({ messageId, dateInvite }: { messageId: string; dateInvite: ChatMessage["dateInvite"] }) => {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, dateInvite } : m)));
      }
    );
    socket.on("date-invite:rejected", ({ error }: { messageId: string; error: string }) => {
      setEditError(error);
    });
    socket.on("message:delete-rejected", ({ error }: { messageId: string; error: string }) => {
      setEditError(error);
    });
    socket.on("typing:update", ({ roomId: updatedRoomId, authors }: { roomId: string; authors: string[] }) => {
      if (updatedRoomId !== roomId) return;
      setTypingAuthors(authors.filter((a) => a !== authorRef.current));
    });
    socket.on(
      "location:update",
      ({ messageId, latitude, longitude }: { messageId: string; latitude: number; longitude: number }) => {
        setLiveLocationUpdates((prev) => ({ ...prev, [messageId]: { latitude, longitude } }));
      }
    );
    socket.on("location:rejected", ({ messageId }: { messageId: string; error?: string }) => {
      if (liveShareRef.current?.messageId === messageId) {
        stopLiveShareTracking();
        setLocationError("Your live location share has ended.");
      }
    });

    // Badoo's real in-app audio call (#128) — see calls.ts and the
    // startCall/acceptCall/endCall/createPeerConnection helpers above.
    socket.on("call:incoming", (call: CallInfo) => {
      if (call.caller === authorRef.current) {
        // Our own outgoing invite, echoed back to the whole room (this
        // socket is in it too) — just learn the call id, stay "calling".
        setActiveCall(call);
        return;
      }
      if (call.callee !== authorRef.current) return; // some other pair's call in a group room
      setActiveCall(call);
      setCallState("ringing");
    });
    socket.on("call:accepted", async (call: CallInfo) => {
      if (activeCallRef.current && call.id !== activeCallRef.current.id) return;
      setActiveCall(call);
      setCallState("active");
      const remoteAuthor = call.caller === authorRef.current ? call.callee : call.caller;
      try {
        const rawStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.video });
        localStreamRef.current = rawStream;

        let outgoingStream = rawStream;
        if (call.video) {
          const videoTrack = rawStream.getVideoTracks()[0];
          if (backgroundBlurEnabled && videoTrack) {
            const applied = await applyBackgroundBlur(videoTrack);
            if (!applied) setBackgroundBlurUnsupported(true);
          }
          if (beautyFilterEnabled) {
            const { stream: processedStream, stop } = applyBeautyFilter(rawStream);
            beautyFilterCleanupRef.current = stop;
            outgoingStream = processedStream;
          }
          if (localVideoRef.current) localVideoRef.current.srcObject = outgoingStream;
        }

        const pc = createPeerConnection(call.id, remoteAuthor, call.video);
        outgoingStream.getTracks().forEach((track) => pc.addTrack(track, outgoingStream));
        if (call.caller === authorRef.current) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("call:signal", { callId: call.id, roomId, from: authorRef.current, to: remoteAuthor, data: { type: "offer", sdp: offer.sdp } });
        }
      } catch {
        setCallError(call.video ? "Camera/microphone access is required for a video call" : "Microphone access is required for a call");
        socket.emit("call:end", { callId: call.id, author: authorRef.current });
        teardownCall();
      }
    });
    socket.on(
      "call:signal",
      async ({ callId, from, to, data }: { callId: string; from: string; to: string; data: { type: string; sdp?: string; candidate?: RTCIceCandidateInit } }) => {
        if (to !== authorRef.current) return;
        const pc = peerConnectionRef.current;
        if (!pc) return;
        if (data.type === "offer" && data.sdp) {
          await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("call:signal", { callId, roomId, from: authorRef.current, to: from, data: { type: "answer", sdp: answer.sdp } });
        } else if (data.type === "answer" && data.sdp) {
          await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        } else if (data.type === "ice-candidate" && data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch {
            // A stray/late ICE candidate after the connection settled — harmless to drop.
          }
        }
      }
    );
    socket.on("call:ended", ({ callId }: { callId: string; endedBy: string }) => {
      if (activeCallRef.current?.id === callId) teardownCall();
    });
    socket.on("call:rejected", ({ reason }: { reason?: string }) => {
      setCallError(reason ?? "Call failed");
      setCallState("idle");
    });
    // Bumble's real AI "unkind message" warning (#143) — a soft nudge, not
    // a rejection: the server held the message back and is asking the
    // sender to confirm before it goes through.
    socket.on("message:warning", (payload: { reason?: string }) => {
      if (lastSendPayloadRef.current) {
        setPendingWarning({ payload: lastSendPayloadRef.current, reason: payload?.reason });
      }
    });
    socket.on("message:rejected", (payload: { reason?: string; error?: string }) => {
      if (payload?.reason === "scam_content") {
        setImageError("That message looks like it violates ChatApp's policy against financial and crypto scams, so it wasn't sent.");
      } else if (payload?.reason === "rate_limited") {
        setImageError("You're sending messages too quickly. Please wait a moment and try again.");
      } else if (payload?.reason === "guest_mode") {
        setImageError("Guests can't send messages — sign up to chat.");
      } else if (payload?.reason === "first_message_gender_rule") {
        // Bumble's real "women message first" rule (#135).
        setImageError(payload.error ?? "Only she can send the first message in this match.");
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
        // #125: anything that arrived while this tab was hidden was only
        // marked delivered above — catch it up to read now that it's
        // actually being looked at. Marking an already-read message read
        // again is harmless (readReceipts.ts's markRead is idempotent).
        for (const message of messagesRef.current) {
          if (message.roomId === roomId && message.author !== authorRef.current) {
            socket.emit("message:read", { roomId, messageId: message.id, author: authorRef.current });
          }
        }
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
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      stopLiveShareTracking();
      teardownCall();
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

  // Bumble's real "Search within conversation text" (#140) — server-side
  // substring search over the whole room's history (not just the currently
  // loaded page). Jumping to a result only works if that message is
  // already loaded into `messages`, same disclosed limitation as the
  // `?m=` deep link above.
  const runSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    fetch(
      `${API_URL}/api/rooms/${roomId}/messages/search?q=${encodeURIComponent(searchQuery)}&viewer=${encodeURIComponent(author)}`
    )
      .then((res) => res.json())
      .then((body) => setSearchResults(body.results ?? []))
      .catch(() => setSearchResults([]))
      .finally(() => setIsSearching(false));
  };

  const jumpToMessage = (messageId: string) => {
    const el = messageRefs.current.get(messageId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(messageId);
    setTimeout(() => setHighlightedId(null), 2500);
    setShowSearch(false);
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result as NotificationPermissionState);
  };

  // Bumble's real typing indicator (#126): client-driven start/stop —
  // this client, not the server, is the one that knows when the user
  // stopped typing (a pause in keystrokes), so it debounces its own stop
  // signal rather than the server guessing from a timeout.
  const TYPING_STOP_DELAY_MS = 2000;
  const stopTyping = () => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socketRef.current?.emit("typing:stop", { roomId, author });
    }
  };

  const handleComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (isGuest) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current?.emit("typing:start", { roomId, author });
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(stopTyping, TYPING_STOP_DELAY_MS);
  };

  const sendMessage = async () => {
    if (isGuest) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    // Feeld's real optional E2EE (#149): an encrypted send needs the live
    // socket round trip, not the offline queue below — that queue only
    // knows how to hold plaintext, and silently falling back to sending
    // this message unencrypted once reconnected would break the very
    // guarantee the user turned encryption on for.
    if (e2eeEnabled && sharedKey) {
      if (!socketRef.current?.connected) {
        setE2eeError("Can't send an encrypted message while offline — reconnect and try again.");
        return;
      }
      setText("");
      stopTyping();
      const encrypted = await encryptText(sharedKey, trimmed);
      socketRef.current.emit("message:send", {
        roomId,
        author,
        text: "",
        encrypted,
        replyToId: replyTarget?.id,
        replyToAuthor: replyTarget?.author,
        replyToText: replyTarget?.text,
        asGuest: isGuest,
        recipient,
      });
      setReplyTarget(null);
      return;
    }

    setText("");
    stopTyping();

    if (socketRef.current?.connected) {
      const payload: SendMessagePayload = {
        roomId,
        author,
        text: trimmed,
        replyToId: replyTarget?.id,
        replyToAuthor: replyTarget?.author,
        replyToText: replyTarget?.text,
        asGuest: isGuest,
        recipient,
      };
      lastSendPayloadRef.current = payload;
      socketRef.current.emit("message:send", payload);
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

  // #143's "Send anyway": re-emits the exact payload the server warned
  // about, with overrideWarning set so it isn't held back a second time.
  const sendWarnedMessageAnyway = () => {
    if (!pendingWarning) return;
    socketRef.current?.emit("message:send", { ...pendingWarning.payload, overrideWarning: true });
    setPendingWarning(null);
  };

  // #143's "Edit": restores the flagged text to the composer instead of
  // sending it, so the user can revise it.
  const editWarnedMessage = () => {
    if (!pendingWarning) return;
    setText(pendingWarning.payload.text);
    setPendingWarning(null);
  };

  const copyMessageLink = (messageId: string) => {
    const url = `${window.location.origin}/room/${roomId}?m=${messageId}`;
    navigator.clipboard?.writeText(url).catch(() => {
      // Clipboard API unavailable/denied — link is still shareable manually via the URL bar.
    });
  };

  const startEdit = (message: ChatMessage) => {
    setEditError(null);
    setEditingMessageId(message.id);
    setEditText(message.text);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const submitEdit = () => {
    if (!editingMessageId || !editText.trim()) return;
    socketRef.current?.emit("message:edit", { roomId, messageId: editingMessageId, author, text: editText.trim() });
    setEditingMessageId(null);
    setEditText("");
  };

  const deleteMessage = (messageId: string) => {
    if (!confirm("Delete this message for everyone?")) return;
    setEditError(null);
    socketRef.current?.emit("message:delete", { roomId, messageId, author });
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

  // Bumble/Snapchat-style "view once, then gone" chat photo (#123): same
  // compress-then-upload pipeline as sendImage(), but to the self-
  // destruct endpoint (see selfDestructPhotos.ts) and carrying `author`
  // so the server lets the sender keep re-viewing their own sent photo.
  const sendSelfDestructPhoto = async (file: File) => {
    if (isGuest) return;
    setSelfDestructError(null);
    setIsSendingSelfDestructPhoto(true);
    try {
      const { mimeType, base64 } = await compressImage(file);
      const uploadRes = await fetch(`${API_URL}/api/self-destruct-photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, mimeType, data: base64 }),
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
        selfDestructImageUrl: `${API_URL}${url}`,
        asGuest: isGuest,
      });
    } catch (err) {
      setSelfDestructError(err instanceof Error ? err.message : "Failed to send photo");
    } finally {
      setIsSendingSelfDestructPhoto(false);
    }
  };

  const handleSelfDestructFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) sendSelfDestructPhoto(file);
  };

  // Tinder's real "send a GIF/sticker" (#124) — a picked Giphy result's
  // URL points at Giphy's own CDN, so this is just a regular chat image
  // message (imageUrl), no upload/storage of our own needed.
  const sendGif = (url: string) => {
    if (isGuest) return;
    socketRef.current?.emit("message:send", { roomId, author, text: "", imageUrl: url, asGuest: isGuest });
    setShowGifPicker(false);
  };

  // WhatsApp/Bumble's real "share live location" (#127): re-sends the
  // sharer's current position every 15s to the message that started the
  // share, until it expires — a poll rather than watchPosition's
  // continuous stream, both simpler to bound/clean up and closer to how
  // real apps throttle live-location updates anyway.
  const LIVE_SHARE_UPDATE_INTERVAL_MS = 15_000;
  const stopLiveShareTracking = () => {
    if (liveShareRef.current) {
      clearInterval(liveShareRef.current.intervalId);
      liveShareRef.current = null;
    }
  };
  const startLiveShareTracking = (messageId: string, expiresAt: string) => {
    stopLiveShareTracking();
    const intervalId = setInterval(() => {
      if (new Date(expiresAt).getTime() <= Date.now()) {
        stopLiveShareTracking();
        return;
      }
      navigator.geolocation?.getCurrentPosition((position) => {
        socketRef.current?.emit("location:update", {
          roomId,
          messageId,
          author,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      });
    }, LIVE_SHARE_UPDATE_INTERVAL_MS);
    liveShareRef.current = { messageId, expiresAt, intervalId };
  };

  const sendLocation = (payload: LocationSharePayload) => {
    if (isGuest) return;
    socketRef.current?.emit("message:send", {
      roomId,
      author,
      text: "",
      location: {
        latitude: payload.latitude,
        longitude: payload.longitude,
        label: payload.label,
        live: payload.live,
        durationMinutes: payload.durationMinutes,
      },
      asGuest: isGuest,
    });
    setShowLocationPicker(false);
  };

  // Feeld's real optional end-to-end encrypted chat (#149) — only
  // offered against a known `recipient` (a fresh 1:1 match): a shared
  // AES key needs a known second party to derive it with, same reasoning
  // as #135's gender rule and #148's game only applying with a recipient.
  const enableE2EE = async () => {
    if (!recipient) return;
    setE2eeBusy(true);
    setE2eeError(null);
    try {
      const keyPair = await getOrCreateKeyPair(author);
      const ownPublicKeyJwk = await exportPublicKeyJwk(keyPair.publicKey);
      await fetch(`${API_URL}/api/e2ee/public-key/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKeyJwk: ownPublicKeyJwk }),
      });

      const res = await fetch(`${API_URL}/api/e2ee/public-key/${encodeURIComponent(recipient)}`);
      if (!res.ok) {
        setE2eeError("Your match hasn't turned on encryption yet — ask them to enable it too.");
        return;
      }
      const { publicKeyJwk: peerPublicKeyJwk } = await res.json();
      const derivedKey = await deriveSharedKey(keyPair.privateKey, peerPublicKeyJwk);
      setSharedKey(derivedKey);
      setE2eeEnabled(true);
    } catch {
      setE2eeError("Failed to set up encryption — please try again.");
    } finally {
      setE2eeBusy(false);
    }
  };

  const disableE2EE = () => {
    setE2eeEnabled(false);
    setSharedKey(null);
  };

  // Snapchat/Bumble's real "play a mini-game within chat" (#148) — only
  // offered against a known `recipient` (a fresh 1:1 match), same as the
  // server-side requirement in server.ts's message:send.
  const startGame = () => {
    if (isGuest || !recipient) return;
    socketRef.current?.emit("message:send", {
      roomId,
      author,
      text: "",
      startGame: true,
      recipient,
      asGuest: isGuest,
    });
  };

  const makeGameMove = (messageId: string, cellIndex: number) => {
    socketRef.current?.emit("game:move", { roomId, messageId, author, cellIndex });
  };

  // Bumble's real "suggest a type of date" quick-reply chip (#147) — a
  // lighter-weight sibling to a full date invitation: no location/time
  // form, just an instant themed conversation starter. The server fills
  // in the message text from the category's own label (see
  // dateProposals.ts) if none is sent.
  const sendDateProposal = (category: DateProposalCategory) => {
    if (isGuest) return;
    socketRef.current?.emit("message:send", {
      roomId,
      author,
      text: "",
      dateProposalCategory: category,
      asGuest: isGuest,
    });
    setShowDateProposalPicker(false);
  };

  const sendDateInvite = (payload: DateInviteSharePayload) => {
    if (isGuest) return;
    socketRef.current?.emit("message:send", {
      roomId,
      author,
      text: "",
      dateInvite: payload,
      asGuest: isGuest,
    });
    setShowDateInvitePicker(false);
  };

  const respondToDateInvite = (messageId: string, response: "accepted" | "declined") => {
    socketRef.current?.emit("date-invite:respond", { roomId, messageId, author, response });
  };

  const STUN_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

  const teardownCall = () => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    beautyFilterCleanupRef.current?.();
    beautyFilterCleanupRef.current = null;
    setBackgroundBlurUnsupported(false);
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setActiveCall(null);
    setCallState("idle");
  };

  const createPeerConnection = (callId: string, remoteAuthor: string, video: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("call:signal", {
          callId,
          roomId,
          from: authorRef.current,
          to: remoteAuthor,
          data: { type: "ice-candidate", candidate: event.candidate.toJSON() },
        });
      }
    };
    // A single remote stream carries both tracks for a video call — the
    // <video> element plays its audio track too, so only one needs it.
    pc.ontrack = (event) => {
      const target = video ? remoteVideoRef.current : remoteAudioRef.current;
      if (target) target.srcObject = event.streams[0];
    };
    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = (callee: string, video: boolean) => {
    if (isGuest || callState !== "idle") return;
    setCallError(null);
    socketRef.current?.emit("call:invite", { roomId, caller: author, callee, video });
    setCallState("calling");
  };

  const acceptCall = () => {
    if (!activeCall) return;
    socketRef.current?.emit("call:accept", { callId: activeCall.id, author });
  };

  const endCall = () => {
    if (activeCall) {
      socketRef.current?.emit("call:end", { callId: activeCall.id, author });
    }
    teardownCall();
  };

  // Badoo's real voice-note messages with a waveform (#122): record via
  // MediaRecorder, compute the waveform client-side (see
  // voiceNoteWaveform.ts — this server has no audio-decoding capability
  // of its own), then upload and send the same way sendImage() does.
  const sendVoiceNote = async (blob: Blob) => {
    if (isGuest) return;
    setVoiceNoteError(null);
    setIsSendingVoiceNote(true);
    try {
      const [waveform, base64] = await Promise.all([computeWaveform(blob), blobToBase64(blob)]);
      const uploadRes = await fetch(`${API_URL}/api/voice-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: blob.type, data: base64, waveform }),
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const { url, waveform: savedWaveform } = await uploadRes.json();
      socketRef.current?.emit("message:send", {
        roomId,
        author,
        text: "",
        audioUrl: `${API_URL}${url}`,
        waveform: savedWaveform,
        asGuest: isGuest,
      });
    } catch (err) {
      setVoiceNoteError(err instanceof Error ? err.message : "Failed to send voice note");
    } finally {
      setIsSendingVoiceNote(false);
    }
  };

  const startRecording = async () => {
    if (isGuest || isRecording) return;
    setVoiceNoteError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceNoteError("Voice notes aren't supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        sendVoiceNote(blob);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch {
      setVoiceNoteError("Microphone access is required to record a voice note");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
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

  // #128: this app has no separate "conversation participants" list —
  // the other person to call is derived from who else has actually
  // posted in this room. A call button only makes sense once that's
  // unambiguous (exactly one other person); a group room (e.g. #109's
  // Double Date) hides it rather than guessing who to ring.
  const otherParticipants = Array.from(new Set(messages.filter((m) => m.author !== author).map((m) => m.author)));
  const callTarget = otherParticipants.length === 1 ? otherParticipants[0] : undefined;

  useEffect(() => {
    if (!callTarget) {
      setVideoCallEligibility(null);
      return;
    }
    fetch(
      `${API_URL}/api/rooms/${encodeURIComponent(roomId)}/video-call-eligibility?caller=${encodeURIComponent(author)}&callee=${encodeURIComponent(callTarget)}`
    )
      .then((res) => res.json())
      .then(setVideoCallEligibility)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callTarget, messages.length, roomId, author]);

  useEffect(() => {
    fetch(`${API_URL}/api/video-call-effects/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setBeautyFilterEnabled(body.effects?.beautyFilter ?? false);
        setBackgroundBlurEnabled(body.effects?.backgroundBlur ?? false);
      })
      .catch(() => {});
  }, [author]);

  const toggleVideoCallEffect = (effect: "beautyFilter" | "backgroundBlur", value: boolean) => {
    const nextBeautyFilter = effect === "beautyFilter" ? value : beautyFilterEnabled;
    const nextBackgroundBlur = effect === "backgroundBlur" ? value : backgroundBlurEnabled;
    setBeautyFilterEnabled(nextBeautyFilter);
    setBackgroundBlurEnabled(nextBackgroundBlur);
    fetch(`${API_URL}/api/video-call-effects/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beautyFilter: nextBeautyFilter, backgroundBlur: nextBackgroundBlur }),
    }).catch(() => {});
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
          <button
            className="chat-app__theme-toggle"
            onClick={() => setShowSearch((prev) => !prev)}
            title="Search within conversation text"
          >
            🔍 Search
          </button>
          <label className="chat-app__data-saver-toggle">
            <input type="checkbox" checked={dataSaverEnabled} onChange={toggleDataSaver} />
            Data Saver Mode
          </label>
        </div>
      </div>
      {showSearch && (
        <div className="chat-app__search-panel">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search this conversation..."
              autoFocus
            />
            <button type="submit" disabled={isSearching}>
              {isSearching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchResults.length > 0 && (
            <ul className="chat-app__search-results">
              {searchResults.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => jumpToMessage(result.id)}>
                    <strong>{result.author}:</strong> {result.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
            <p className="chat-app__search-empty">No messages match &ldquo;{searchQuery}&rdquo;.</p>
          )}
        </div>
      )}
      <SOSButton author={author} />
      {callState === "idle" && callTarget && !isGuest && (
        <div className="chat-app__call-buttons">
          <button className="chat-app__call-button" onClick={() => startCall(callTarget, false)}>
            📞 Call {callTarget}
          </button>
          {videoCallEligibility?.eligible ? (
            <button className="chat-app__call-button" onClick={() => startCall(callTarget, true)}>
              📹 Video call {callTarget}
            </button>
          ) : (
            videoCallEligibility && (
              <span className="chat-app__video-call-locked" title="Bumble's real mandatory text-first rule (#130)">
                🔒 Send {videoCallEligibility.required - videoCallEligibility.messagesExchanged} more message
                {videoCallEligibility.required - videoCallEligibility.messagesExchanged === 1 ? "" : "s"} to unlock video calling
              </span>
            )
          )}
        </div>
      )}
      {!isGuest && (
        <div className="chat-app__video-effects-toggle">
          <label>
            <input
              type="checkbox"
              checked={beautyFilterEnabled}
              onChange={(e) => toggleVideoCallEffect("beautyFilter", e.target.checked)}
            />
            ✨ Beauty filter
          </label>
          <label>
            <input
              type="checkbox"
              checked={backgroundBlurEnabled}
              onChange={(e) => toggleVideoCallEffect("backgroundBlur", e.target.checked)}
            />
            🌫️ Background blur
          </label>
          {backgroundBlurUnsupported && (
            <span className="chat-app__video-call-locked">Background blur isn&apos;t supported by your browser/camera.</span>
          )}
        </div>
      )}
      {callState !== "idle" && activeCall && (
        <div className="chat-app__call-panel">
          {callState === "calling" && <p>{activeCall.video ? "Video calling" : "Calling"} {activeCall.callee}…</p>}
          {callState === "ringing" && (
            <p>
              {activeCall.video ? "📹" : "📞"} Incoming {activeCall.video ? "video " : ""}call from {activeCall.caller}
            </p>
          )}
          {callState === "active" && (
            <p>
              {activeCall.video ? "📹" : "🔊"} On a {activeCall.video ? "video " : ""}call with{" "}
              {activeCall.caller === author ? activeCall.callee : activeCall.caller}
            </p>
          )}
          <div className="chat-app__call-panel-actions">
            {callState === "ringing" && (
              <button className="chat-app__call-accept" onClick={acceptCall}>
                Accept
              </button>
            )}
            <button className="chat-app__call-end" onClick={endCall}>
              {callState === "ringing" ? "Decline" : "Hang up"}
            </button>
          </div>
          {activeCall.video ? (
            <div className="chat-app__video-call">
              <video ref={remoteVideoRef} className="chat-app__remote-video" autoPlay playsInline />
              <video ref={localVideoRef} className="chat-app__local-video" autoPlay playsInline muted />
            </div>
          ) : (
            <audio ref={remoteAudioRef} autoPlay />
          )}
        </div>
      )}
      {callError && <p style={{ color: "var(--color-danger)" }}>{callError}</p>}
      {editError && <p style={{ color: "var(--color-danger)" }}>{editError}</p>}
      {imageError && <p className="chat-app__status chat-app__status--offline">{imageError}</p>}
      {pendingWarning && (
        <div className="chat-app__content-warning" role="alert">
          <p>
            {pendingWarning.reason === "harassment"
              ? "This message may come across as threatening or unkind."
              : "This message may come across as inappropriate."}{" "}
            Are you sure you want to send it?
          </p>
          <button type="button" onClick={editWarnedMessage}>
            Edit message
          </button>
          <button type="button" onClick={sendWarnedMessageAnyway}>
            Send anyway
          </button>
        </div>
      )}
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
            viewer={author}
            status={m.author === author ? messageStatuses[m.id] : undefined}
            liveLocationUpdate={liveLocationUpdates[m.id]}
            isEditing={editingMessageId === m.id}
            editText={editText}
            onEditTextChange={setEditText}
            onStartEdit={startEdit}
            onSaveEdit={submitEdit}
            onCancelEdit={cancelEdit}
            onDelete={deleteMessage}
            sharedKey={sharedKey}
            onGameMove={makeGameMove}
            onRespondDateInvite={respondToDateInvite}
          />
        ))}
        {queue.map((q) => (
          <div key={q.clientId} className="chat-app__message chat-app__message--queued">
            <strong>{q.author}: </strong>
            <span>{q.text}</span>
            <em className="chat-app__queued-tag">(queued)</em>
          </div>
        ))}
        {typingAuthors.length > 0 && (
          <p className="chat-app__typing-indicator">
            {typingAuthors.length === 1
              ? `${typingAuthors[0]} is typing…`
              : `${typingAuthors.join(", ")} are typing…`}
          </p>
        )}
        {isSendingImage && <p className="chat-app__status">Compressing and sending image…</p>}
        {isRecording && <p className="chat-app__status">Recording voice note…</p>}
        {isSendingVoiceNote && <p className="chat-app__status">Sending voice note…</p>}
        {voiceNoteError && <p style={{ color: "var(--color-danger)" }}>{voiceNoteError}</p>}
        {isSendingSelfDestructPhoto && <p className="chat-app__status">Sending disappearing photo…</p>}
        {selfDestructError && <p style={{ color: "var(--color-danger)" }}>{selfDestructError}</p>}
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
      {!isGuest && callTarget && messages.length < 3 && (
        <IcebreakerSuggestions author={author} candidate={callTarget} onPick={setText} />
      )}
      <div className="chat-app__composer">
        <textarea
          ref={composerRef}
          className="chat-app__input chat-app__input--textarea"
          value={text}
          onChange={handleComposerChange}
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
        <button
          className={`chat-app__voice-button${isRecording ? " chat-app__voice-button--recording" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isGuest || isSendingVoiceNote || !liveUpdatesEnabled}
          title={isRecording ? "Stop recording" : "Record a voice note"}
        >
          {isRecording ? "⏹" : "🎤"}
        </button>
        <input
          ref={selfDestructFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleSelfDestructFileChange}
          className="chat-app__file-input"
        />
        <button
          className="chat-app__image-button"
          onClick={() => selfDestructFileInputRef.current?.click()}
          disabled={isGuest || isSendingSelfDestructPhoto || !liveUpdatesEnabled}
          title="Send a disappearing photo"
        >
          🔥📷
        </button>
        <button
          className="chat-app__image-button"
          onClick={() => setShowGifPicker((v) => !v)}
          disabled={isGuest || !liveUpdatesEnabled}
          title="Send a GIF or sticker"
        >
          GIF
        </button>
        <button
          className="chat-app__image-button"
          onClick={() => setShowLocationPicker((v) => !v)}
          disabled={isGuest || !liveUpdatesEnabled}
          title="Send your location"
        >
          📍
        </button>
        {recipient && (
          <button
            className="chat-app__image-button"
            onClick={() => (e2eeEnabled ? disableE2EE() : enableE2EE())}
            disabled={isGuest || !liveUpdatesEnabled || e2eeBusy}
            title={e2eeEnabled ? "Turn off end-to-end encryption" : "Turn on end-to-end encryption"}
          >
            {e2eeEnabled ? "🔒" : "🔓"}
          </button>
        )}
        {recipient && (
          <button
            className="chat-app__image-button"
            onClick={startGame}
            disabled={isGuest || !liveUpdatesEnabled}
            title="Play Tic-Tac-Toe to break the ice"
          >
            🎮
          </button>
        )}
        <button
          className="chat-app__image-button"
          onClick={() => setShowDateProposalPicker((v) => !v)}
          disabled={isGuest || !liveUpdatesEnabled}
          title="Suggest a type of date"
        >
          💡
        </button>
        <button
          className="chat-app__image-button"
          onClick={() => setShowDateInvitePicker((v) => !v)}
          disabled={isGuest || !liveUpdatesEnabled}
          title="Propose a real date"
        >
          📅
        </button>
        <button className="chat-app__send" onClick={sendMessage} disabled={isGuest || !liveUpdatesEnabled}>
          {t("send")}
        </button>
      </div>
      {showGifPicker && <GifPicker onPick={sendGif} onClose={() => setShowGifPicker(false)} />}
      {showLocationPicker && <LocationPicker onSend={sendLocation} onClose={() => setShowLocationPicker(false)} />}
      {showDateProposalPicker && (
        <div className="chat-app__date-proposal-picker">
          {DATE_PROPOSAL_CATEGORIES.map((category: DateProposalCategory) => (
            <button key={category} onClick={() => sendDateProposal(category)}>
              {DATE_PROPOSAL_LABELS[category]}
            </button>
          ))}
          <button onClick={() => setShowDateProposalPicker(false)}>✕</button>
        </div>
      )}
      {showDateInvitePicker && (
        <DateInvitePicker onSend={sendDateInvite} onClose={() => setShowDateInvitePicker(false)} />
      )}
      {locationError && <p style={{ color: "var(--color-danger)" }}>{locationError}</p>}
      {e2eeError && <p style={{ color: "var(--color-danger)" }}>{e2eeError}</p>}
      {e2eeEnabled && <p className="chat-app__status">🔒 End-to-end encryption is on for this chat</p>}
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
          <>
            <p style={{ color: "var(--color-muted)" }}>Drag a photo to reorder your album.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
              {albumPhotoIds.map((id) => (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData("text/plain");
                    if (draggedId) reorderAlbumPhoto(draggedId, id);
                  }}
                  style={{ position: "relative", cursor: "grab" }}
                >
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
          </>
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
      <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
        <Link href="/settings/profile">Edit profile &rarr;</Link>
        {" · "}
        <Link href="/discover">Discover &rarr;</Link>
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
