import { SendMessagePayload } from "@chatapp/shared";

/**
 * Guest mode is read-only: browsing/viewing the chat needs no signup, but
 * sending a message does. Pulled out as a pure function (rather than inline
 * in the socket handler) so the rule is unit-testable without a live
 * socket connection.
 */
export function isGuestSendAllowed(payload: Pick<SendMessagePayload, "asGuest">): boolean {
  return !payload.asGuest;
}
