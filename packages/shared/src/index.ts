export interface ChatMessage {
  id: string;
  roomId: string;
  author: string;
  text: string;
  createdAt: string;
  imageUrl?: string;
}

export interface SendMessagePayload {
  roomId: string;
  author: string;
  text: string;
  imageUrl?: string;
}

export const DEFAULT_ROOM_ID = "general";
