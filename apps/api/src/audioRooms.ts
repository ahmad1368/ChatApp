export type AudioRoomRole = "host" | "speaker" | "listener";

export interface AudioRoom {
  id: string;
  title: string;
  description: string;
  host: string;
  createdAt: string;
}

export interface AudioRoomDetails extends AudioRoom {
  speakers: string[];
  listeners: string[];
  raisedHands: string[];
}

export interface AudioRoomSummary extends AudioRoom {
  speakerCount: number;
  listenerCount: number;
}

export type CreateRoomResult = { success: true; room: AudioRoom } | { success: false; error: string };
export type JoinRoomResult = { success: true; room: AudioRoomDetails } | { success: false; error: string };
export type LeaveRoomResult = { success: true; ended: boolean; newHost?: string } | { success: false; error: string };
export type RaiseHandResult = { success: true } | { success: false; error: string };
export type ModerationResult = { success: true; room: AudioRoomDetails } | { success: false; error: string };

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `audio-room-${Date.now()}-${idCounter}`;
}

/**
 * Match.com's real "Support for podcasts or group audio rooms" (#225):
 * the real, live-membership half of a Clubhouse-style room — host,
 * speakers, listeners, hand-raising, and host moderation (invite to
 * speak / move back to listener) — kept honest about what it isn't: this
 * app has no SFU (LiveKit or otherwise) to actually mix N-way audio, the
 * same disclosed-limitation pattern #128/#129's CallStore uses for
 * missing TURN relay. Real microphone audio between exactly two people
 * already exists via CallStore's WebRTC signaling; wiring that into an
 * N-way SFU stream is out of scope here.
 */
export class AudioRoomStore {
  private roomsById = new Map<string, AudioRoom>();
  private rolesByRoomId = new Map<string, Map<string, AudioRoomRole>>();
  private raisedHandsByRoomId = new Map<string, Set<string>>();

  createRoom(host: unknown, payload: { title?: unknown; description?: unknown } | undefined): CreateRoomResult {
    const hostName = typeof host === "string" ? host.trim() : "";
    if (!hostName) return { success: false, error: "host is required" };

    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    if (!title) return { success: false, error: "title is required" };

    const description = typeof payload?.description === "string" ? payload.description.trim() : "";

    const room: AudioRoom = { id: generateId(), title, description, host: hostName, createdAt: new Date().toISOString() };
    this.roomsById.set(room.id, room);
    this.rolesByRoomId.set(room.id, new Map([[hostName, "host"]]));
    this.raisedHandsByRoomId.set(room.id, new Set());
    return { success: true, room };
  }

  listActiveRooms(): AudioRoomSummary[] {
    return [...this.roomsById.values()]
      .map((room) => this.toSummary(room))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private toSummary(room: AudioRoom): AudioRoomSummary {
    const roles = [...(this.rolesByRoomId.get(room.id)?.values() ?? [])];
    return {
      ...room,
      speakerCount: roles.filter((role) => role === "host" || role === "speaker").length,
      listenerCount: roles.filter((role) => role === "listener").length,
    };
  }

  getRoom(roomId: string): AudioRoomDetails | undefined {
    const room = this.roomsById.get(roomId);
    if (!room) return undefined;
    return this.toDetails(room);
  }

  private toDetails(room: AudioRoom): AudioRoomDetails {
    const roles = this.rolesByRoomId.get(room.id) ?? new Map();
    const speakers: string[] = [];
    const listeners: string[] = [];
    for (const [author, role] of roles) {
      if (role === "host" || role === "speaker") speakers.push(author);
      else listeners.push(author);
    }
    return { ...room, speakers, listeners, raisedHands: [...(this.raisedHandsByRoomId.get(room.id) ?? [])] };
  }

  join(author: unknown, roomId: string): JoinRoomResult {
    const room = this.roomsById.get(roomId);
    if (!room) return { success: false, error: "Room not found" };

    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const roles = this.rolesByRoomId.get(roomId)!;
    if (roles.has(authorName)) return { success: false, error: "You're already in this room" };

    roles.set(authorName, "listener");
    return { success: true, room: this.toDetails(room) };
  }

  leave(author: unknown, roomId: string): LeaveRoomResult {
    const room = this.roomsById.get(roomId);
    if (!room) return { success: false, error: "Room not found" };

    const authorName = typeof author === "string" ? author.trim() : "";
    const roles = this.rolesByRoomId.get(roomId)!;
    if (!roles.has(authorName)) return { success: false, error: "You're not in this room" };

    const wasHost = roles.get(authorName) === "host";
    roles.delete(authorName);
    this.raisedHandsByRoomId.get(roomId)?.delete(authorName);

    if (!wasHost) return { success: true, ended: false };

    const nextHost = [...roles.entries()].find(([, role]) => role === "speaker")?.[0];
    if (nextHost) {
      roles.set(nextHost, "host");
      room.host = nextHost;
      return { success: true, ended: false, newHost: nextHost };
    }

    this.roomsById.delete(roomId);
    this.rolesByRoomId.delete(roomId);
    this.raisedHandsByRoomId.delete(roomId);
    return { success: true, ended: true };
  }

  raiseHand(author: unknown, roomId: string): RaiseHandResult {
    const roles = this.rolesByRoomId.get(roomId);
    if (!roles) return { success: false, error: "Room not found" };

    const authorName = typeof author === "string" ? author.trim() : "";
    const role = roles.get(authorName);
    if (!role) return { success: false, error: "Join this room before raising your hand" };
    if (role !== "listener") return { success: false, error: "Only listeners can raise their hand" };

    this.raisedHandsByRoomId.get(roomId)!.add(authorName);
    return { success: true };
  }

  inviteToSpeak(host: unknown, roomId: string, author: unknown): ModerationResult {
    const room = this.roomsById.get(roomId);
    if (!room) return { success: false, error: "Room not found" };

    const hostName = typeof host === "string" ? host.trim() : "";
    if (room.host !== hostName) return { success: false, error: "Only the host can invite someone to speak" };

    const authorName = typeof author === "string" ? author.trim() : "";
    const roles = this.rolesByRoomId.get(roomId)!;
    if (roles.get(authorName) !== "listener") return { success: false, error: "That person isn't a listener in this room" };

    roles.set(authorName, "speaker");
    this.raisedHandsByRoomId.get(roomId)?.delete(authorName);
    return { success: true, room: this.toDetails(room) };
  }

  moveToListener(host: unknown, roomId: string, author: unknown): ModerationResult {
    const room = this.roomsById.get(roomId);
    if (!room) return { success: false, error: "Room not found" };

    const hostName = typeof host === "string" ? host.trim() : "";
    if (room.host !== hostName) return { success: false, error: "Only the host can move someone back to listening" };

    const authorName = typeof author === "string" ? author.trim() : "";
    if (authorName === hostName) return { success: false, error: "The host can't demote themselves" };

    const roles = this.rolesByRoomId.get(roomId)!;
    if (roles.get(authorName) !== "speaker") return { success: false, error: "That person isn't a speaker in this room" };

    roles.set(authorName, "listener");
    return { success: true, room: this.toDetails(room) };
  }

  endRoom(host: unknown, roomId: string): { success: true } | { success: false; error: string } {
    const room = this.roomsById.get(roomId);
    if (!room) return { success: false, error: "Room not found" };

    const hostName = typeof host === "string" ? host.trim() : "";
    if (room.host !== hostName) return { success: false, error: "Only the host can end this room" };

    this.roomsById.delete(roomId);
    this.rolesByRoomId.delete(roomId);
    this.raisedHandsByRoomId.delete(roomId);
    return { success: true };
  }
}
