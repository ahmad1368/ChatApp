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

export interface MeetupPlanPayload {
  author: string;
  meetingWith: string;
  location: string;
  scheduledAt: string;
}

export interface MeetupPlan extends MeetupPlanPayload {
  id: string;
  shareCode: string;
  createdAt: string;
}

export interface SharedMeetupPlanView {
  author: string;
  meetingWith: string;
  location: string;
  scheduledAt: string;
  createdAt: string;
}

export const SAFETY_TIPS: string[] = [
  "Meet in a public place for the first few dates.",
  "Tell a friend or family member where you're going, who you're meeting, and when you expect to be back.",
  "Video chat before meeting in person to confirm they're who they say they are.",
  "Arrange your own transportation to and from the date.",
  "Stay sober enough to stay aware of your surroundings.",
  "Trust your instincts — if something feels off, it's okay to leave.",
  "Keep your phone charged and easily accessible.",
];

