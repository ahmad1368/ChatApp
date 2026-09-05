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

export const DATE_STATUSES = ["planned", "on_the_way", "arrived", "safe", "need_help"] as const;
export type DateStatus = (typeof DATE_STATUSES)[number];

export const DATE_STATUS_LABELS: Record<DateStatus, string> = {
  planned: "Planned",
  on_the_way: "On the way",
  arrived: "Arrived",
  safe: "Safe",
  need_help: "Needs help",
};

export interface TrustedContactInfo {
  name: string;
  shareCode: string;
}

export interface SharedDatePayload {
  author: string;
  meetingWith: string;
  location: string;
  scheduledAt: string;
  contactNames: string[];
}

export interface SharedDate {
  id: string;
  author: string;
  meetingWith: string;
  location: string;
  scheduledAt: string;
  status: DateStatus;
  revoked: boolean;
  createdAt: string;
  contacts: TrustedContactInfo[];
}

export interface SharedDateView {
  author: string;
  meetingWith: string;
  location: string;
  scheduledAt: string;
  status: DateStatus;
  createdAt: string;
}
