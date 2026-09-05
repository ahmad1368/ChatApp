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

export interface WatermarkSession {
  traceCode: string;
  author: string;
  roomId: string;
  issuedAt: string;
}
