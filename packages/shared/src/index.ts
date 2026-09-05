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
  // Self-reported by the client — see the trust-boundary note in
  // apps/api/src/server.ts (same limitation as #26-#37's :userId trust:
  // there's no merged auth session yet to verify this against). The
  // client already hides the send UI for guests; this is defense in
  // depth for a request that bypasses the UI.
  asGuest?: boolean;
}

export const DEFAULT_ROOM_ID = "general";
