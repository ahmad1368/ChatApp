export interface ChatMessage {
  id: string;
  roomId: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface SendMessagePayload {
  roomId: string;
  author: string;
  text: string;
}

export const DEFAULT_ROOM_ID = "general";

export interface BlockPayload {
  blockerAuthor: string;
  blockedAuthor: string;
}

export interface BlockRecord extends BlockPayload {
  createdAt: string;
}
