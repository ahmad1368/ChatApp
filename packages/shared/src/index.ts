export interface ChatMessage {
  id: string;
  roomId: string;
  author: string;
  text: string;
  createdAt: string;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
}

export interface SendMessagePayload {
  roomId: string;
  author: string;
  text: string;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
}

export const DEFAULT_ROOM_ID = "general";
