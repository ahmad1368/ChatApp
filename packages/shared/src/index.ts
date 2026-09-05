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

// Categorized report reasons — matches the "Report" half of Bumble's
// Report/Block/SOS safety trio (Block and SOS are separate issues).
export const REPORT_REASONS = [
  "harassment",
  "hateSpeech",
  "spam",
  "fakeProfile",
  "inappropriateContent",
  "underage",
  "scam",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment or bullying",
  hateSpeech: "Hate speech",
  spam: "Spam",
  fakeProfile: "Fake profile",
  inappropriateContent: "Inappropriate content",
  underage: "Underage user",
  scam: "Scam or fraud",
  other: "Something else",
};

export interface ReportPayload {
  reportedAuthor: string;
  messageId?: string;
  reason: ReportReason;
  details?: string;
}
