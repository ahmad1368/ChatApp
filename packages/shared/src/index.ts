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

export interface EmergencyContact {
  name: string;
  contactMethod: string;
}

export interface SOSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface SOSAlert {
  id: string;
  author: string;
  location: SOSLocation;
  resolved: boolean;
  triggeredAt: string;
  updatedAt: string;
  contacts: { name: string; shareCode: string }[];
}

export interface SOSAlertView {
  author: string;
  location: SOSLocation;
  resolved: boolean;
  triggeredAt: string;
  updatedAt: string;
}
