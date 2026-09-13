import { randomUUID } from "crypto";

export const DIRECT_MESSAGE_REQUEST_COST = 100;
const MAX_TEXT_LENGTH = 500;

export const DIRECT_MESSAGE_REQUEST_STATUSES = ["pending", "accepted", "declined"] as const;
export type DirectMessageRequestStatus = (typeof DIRECT_MESSAGE_REQUEST_STATUSES)[number];

export interface DirectMessageRequest {
  id: string;
  from: string;
  to: string;
  text: string;
  sentAt: string;
  status: DirectMessageRequestStatus;
}

export type SendRequestResult = { success: true; request: DirectMessageRequest } | { success: false; error: string };
export type RespondResult = { success: true; request: DirectMessageRequest } | { success: false; error: string };
export type ValidateResult = { valid: true; from: string; to: string; text: string } | { valid: false; error: string };

/**
 * A pure, side-effect-free check of the same rules send() enforces —
 * so a caller (server.ts) can validate before spending #196's coins,
 * rather than spending first and only then discovering the request
 * itself was invalid.
 */
export function validateDirectMessageRequest(from: unknown, to: unknown, text: unknown): ValidateResult {
  const fromText = typeof from === "string" ? from.trim() : "";
  if (!fromText) return { valid: false, error: "from is required" };
  const toText = typeof to === "string" ? to.trim() : "";
  if (!toText) return { valid: false, error: "to is required" };
  if (fromText === toText) return { valid: false, error: "You can't send a direct message request to yourself" };
  const textValue = typeof text === "string" ? text.trim() : "";
  if (!textValue) return { valid: false, error: "text is required" };
  if (textValue.length > MAX_TEXT_LENGTH) return { valid: false, error: `text must be ${MAX_TEXT_LENGTH} characters or fewer` };
  return { valid: true, from: fromText, to: toText, text: textValue };
}

/**
 * Tinder's real "Pay to open a direct chat without needing a Match"
 * (#208). This app's chat is a single shared room with no formal
 * per-pair "these two only" concept to hard-gate in the first place
 * (see server.ts's message:send comment on payload.recipient, and
 * #135/#136's own gender/expiry rules, which are the only real
 * restrictions that exist today) — so there's no existing match
 * requirement here to retrofit a paid bypass around without breaking
 * those already-shipped rules. What's real and genuinely paid: a
 * request-based channel modeled on real Tinder's own "Message Before
 * Match" UX — spend #196's coins to send one message to someone you
 * haven't matched with, which lands in their own request inbox rather
 * than the open room, and only becomes an actual conversation if they
 * accept it. Coin-spending happens in the route handler (server.ts),
 * same "orchestrate cross-store calls at the call site" shape #197-
 * #199 use.
 */
export class DirectMessageRequestStore {
  private requests: DirectMessageRequest[] = [];

  send(from: unknown, to: unknown, text: unknown): SendRequestResult {
    const validated = validateDirectMessageRequest(from, to, text);
    if (!validated.valid) return { success: false, error: validated.error };

    const request: DirectMessageRequest = {
      id: randomUUID(),
      from: validated.from,
      to: validated.to,
      text: validated.text,
      sentAt: new Date().toISOString(),
      status: "pending",
    };
    this.requests.push(request);
    return { success: true, request };
  }

  respond(requestId: string, author: unknown, accept: unknown): RespondResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (typeof accept !== "boolean") return { success: false, error: "accept must be a boolean" };

    const request = this.requests.find((r) => r.id === requestId);
    if (!request) return { success: false, error: "Request not found" };
    if (request.to !== authorText) return { success: false, error: "Only the recipient can respond to this request" };
    if (request.status !== "pending") return { success: false, error: "This request has already been responded to" };

    request.status = accept ? "accepted" : "declined";
    return { success: true, request };
  }

  /** A recipient's still-pending requests, newest first — array insertion order tracks send order, so this is exact even when two requests are sent in the same millisecond (sentAt alone wouldn't be). */
  getInbox(author: string): DirectMessageRequest[] {
    return this.requests.filter((r) => r.to === author && r.status === "pending").reverse();
  }
}
