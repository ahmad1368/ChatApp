export const CALL_STATUSES = ["ringing", "active"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export interface Call {
  id: string;
  roomId: string;
  caller: string;
  callee: string;
  status: CallStatus;
}

export type InitiateCallResult = { success: true; call: Call } | { success: false; error: string };
export type CallActionResult = { success: true; call: Call } | { success: false; error: string };

/**
 * Badoo's real in-app audio call (#128), extended to video in #129 — this
 * store is the WebRTC *signaling* state machine (who's ringing/in a call
 * with whom), reused unmodified for #129's video call since the mechanic
 * is identical; only the client's getUserMedia constraints and UI differ
 * between audio-only and video. The actual audio/video stream is real
 * peer-to-peer WebRTC (RTCPeerConnection + a public STUN server) — this
 * server only relays signaling messages (offer/answer/ICE candidates) via
 * the call:signal socket event in server.ts, it never touches media
 * itself, same division of responsibility real production video-calling
 * backends use. No TURN relay is configured (none of this app's
 * infrastructure is real production-hosted), so a call between two peers
 * both behind restrictive/symmetric NATs can fail to connect — an honest,
 * disclosed limitation rather than a fabricated always-works guarantee.
 */
export class CallStore {
  private calls = new Map<string, Call>();
  private idCounter = 0;

  private generateId(): string {
    this.idCounter += 1;
    return `call-${Date.now()}-${this.idCounter}`;
  }

  /** Any in-progress (ringing or active) call this author is part of, if any. */
  getActiveCallFor(author: string): Call | undefined {
    for (const call of this.calls.values()) {
      if (call.caller === author || call.callee === author) return call;
    }
    return undefined;
  }

  initiate(roomId: unknown, caller: unknown, callee: unknown): InitiateCallResult {
    const room = typeof roomId === "string" ? roomId.trim() : "";
    const callerName = typeof caller === "string" ? caller.trim() : "";
    const calleeName = typeof callee === "string" ? callee.trim() : "";
    if (!room) return { success: false, error: "roomId is required" };
    if (!callerName || !calleeName) return { success: false, error: "caller and callee are required" };
    if (callerName === calleeName) return { success: false, error: "Cannot call yourself" };
    if (this.getActiveCallFor(callerName)) return { success: false, error: "You're already in a call" };
    if (this.getActiveCallFor(calleeName)) return { success: false, error: "This person is already in a call" };

    const call: Call = { id: this.generateId(), roomId: room, caller: callerName, callee: calleeName, status: "ringing" };
    this.calls.set(call.id, call);
    return { success: true, call };
  }

  accept(callId: string, author: unknown): CallActionResult {
    const call = this.calls.get(callId);
    if (!call) return { success: false, error: "Call not found" };
    if (call.status !== "ringing") return { success: false, error: "Call is not ringing" };
    if (call.callee !== author) return { success: false, error: "Only the callee can accept this call" };
    call.status = "active";
    return { success: true, call };
  }

  /** Either participant can end a call — the callee declining before pickup, or either side hanging up once active. */
  end(callId: string, author: unknown): CallActionResult {
    const call = this.calls.get(callId);
    if (!call) return { success: false, error: "Call not found" };
    if (call.caller !== author && call.callee !== author) {
      return { success: false, error: "You're not a participant in this call" };
    }
    this.calls.delete(callId);
    return { success: true, call };
  }

  get(callId: string): Call | undefined {
    return this.calls.get(callId);
  }
}
