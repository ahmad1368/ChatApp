import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";

export function buildChatMessage(payload: SendMessagePayload): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roomId: payload.roomId || DEFAULT_ROOM_ID,
    author: payload.author,
    text: payload.text,
    createdAt: new Date().toISOString(),
    imageUrl: payload.imageUrl,
    replyToId: payload.replyToId,
    replyToAuthor: payload.replyToAuthor,
    replyToText: payload.replyToText,
  };
}
