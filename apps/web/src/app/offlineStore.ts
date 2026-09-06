import { ChatMessage } from "@chatapp/shared";

const CACHE_KEY_PREFIX = "chatapp:cache:";
const QUEUE_KEY_PREFIX = "chatapp:queue:";

export interface QueuedMessage {
  clientId: string;
  author: string;
  text: string;
  queuedAt: string;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Private browsing, disabled storage, or corrupt data — fall back silently.
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — the app still works, just without the cache.
  }
}

/** Last-known message history for a room, shown immediately on load before the network responds. */
export function loadCachedMessages(roomId: string): ChatMessage[] {
  return readJson(`${CACHE_KEY_PREFIX}${roomId}`, []);
}

export function saveCachedMessages(roomId: string, messages: ChatMessage[]): void {
  writeJson(`${CACHE_KEY_PREFIX}${roomId}`, messages);
}

/** Messages composed while offline, held here until the socket reconnects. */
export function loadQueuedMessages(roomId: string): QueuedMessage[] {
  return readJson(`${QUEUE_KEY_PREFIX}${roomId}`, []);
}

export function saveQueuedMessages(roomId: string, queue: QueuedMessage[]): void {
  writeJson(`${QUEUE_KEY_PREFIX}${roomId}`, queue);
}
