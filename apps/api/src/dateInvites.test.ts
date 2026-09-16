import { test } from "node:test";
import assert from "node:assert/strict";
import { createDateInvite, respondToDateInvite, confirmDate, isFullyConfirmed, isOverdueForConfirmation } from "./dateInvites";
import { DateInvite } from "@chatapp/shared";

test("createDateInvite() rejects a missing location", () => {
  const result = createDateInvite({ proposedAt: "2026-01-01T18:00:00.000Z" });
  assert.equal(result.success, false);
});

test("createDateInvite() rejects a missing proposedAt", () => {
  const result = createDateInvite({ location: "The coffee shop on 5th" });
  assert.equal(result.success, false);
});

test("createDateInvite() rejects an invalid proposedAt", () => {
  const result = createDateInvite({ location: "The coffee shop on 5th", proposedAt: "not-a-date" });
  assert.equal(result.success, false);
});

test("createDateInvite() succeeds with location and proposedAt, defaulting to pending", () => {
  const result = createDateInvite({ location: "The coffee shop on 5th", proposedAt: "2026-01-01T18:00:00.000Z" });
  assert.equal(result.success, true);
  assert.equal(result.success && result.dateInvite.status, "pending");
  assert.equal(result.success && result.dateInvite.location, "The coffee shop on 5th");
  assert.equal(result.success && result.dateInvite.note, undefined);
});

test("createDateInvite() trims a blank note down to undefined", () => {
  const result = createDateInvite({ location: "The park", proposedAt: "2026-01-01T18:00:00.000Z", note: "   " });
  assert.equal(result.success && result.dateInvite.note, undefined);
});

test("createDateInvite() keeps a real note", () => {
  const result = createDateInvite({ location: "The park", proposedAt: "2026-01-01T18:00:00.000Z", note: "Bring a jacket" });
  assert.equal(result.success && result.dateInvite.note, "Bring a jacket");
});

test("respondToDateInvite() rejects the original sender responding to their own invite", () => {
  const invite = { location: "The park", proposedAt: "2026-01-01T18:00:00.000Z", status: "pending" as const };
  const result = respondToDateInvite(invite, "alice", "alice", "accepted");
  assert.equal(result.success, false);
});

test("respondToDateInvite() rejects an invalid response value", () => {
  const invite = { location: "The park", proposedAt: "2026-01-01T18:00:00.000Z", status: "pending" as const };
  const result = respondToDateInvite(invite, "alice", "bob", "maybe");
  assert.equal(result.success, false);
});

test("respondToDateInvite() rejects responding to an invite that's already been decided", () => {
  const invite = { location: "The park", proposedAt: "2026-01-01T18:00:00.000Z", status: "accepted" as const };
  const result = respondToDateInvite(invite, "alice", "bob", "declined");
  assert.equal(result.success, false);
});

test("respondToDateInvite() lets the recipient accept a pending invite", () => {
  const invite = { location: "The park", proposedAt: "2026-01-01T18:00:00.000Z", status: "pending" as const };
  const result = respondToDateInvite(invite, "alice", "bob", "accepted");
  assert.equal(result.success, true);
  assert.equal(result.success && result.dateInvite.status, "accepted");
});

test("respondToDateInvite() lets the recipient decline a pending invite", () => {
  const invite = { location: "The park", proposedAt: "2026-01-01T18:00:00.000Z", status: "pending" as const };
  const result = respondToDateInvite(invite, "alice", "bob", "declined");
  assert.equal(result.success, true);
  assert.equal(result.success && result.dateInvite.status, "declined");
});

test("createDateInvite() stores a known recipient and starts with an empty confirmedBy", () => {
  const result = createDateInvite({ location: "The park", proposedAt: "2026-01-01T18:00:00.000Z" }, "bob");
  assert.equal(result.success && result.dateInvite.recipient, "bob");
  assert.deepEqual(result.success && result.dateInvite.confirmedBy, []);
});

const ACCEPTED_INVITE: DateInvite = {
  location: "The park",
  proposedAt: "2026-01-01T18:00:00.000Z",
  status: "accepted",
  recipient: "bob",
  confirmedBy: [],
};

test("confirmDate() rejects an invite that isn't accepted yet", () => {
  const pending: DateInvite = { ...ACCEPTED_INVITE, status: "pending" };
  const result = confirmDate(pending, "alice", "alice");
  assert.equal(result.success, false);
});

test("confirmDate() rejects someone who isn't the sender or recipient", () => {
  const result = confirmDate(ACCEPTED_INVITE, "alice", "carol");
  assert.equal(result.success, false);
});

test("confirmDate() adds the sender or recipient to confirmedBy", () => {
  const result = confirmDate(ACCEPTED_INVITE, "alice", "alice");
  assert.equal(result.success, true);
  assert.deepEqual(result.success && result.dateInvite.confirmedBy, ["alice"]);
});

test("confirmDate() is idempotent for a repeat confirmation", () => {
  const onceConfirmed = confirmDate(ACCEPTED_INVITE, "alice", "alice");
  const invite = onceConfirmed.success ? onceConfirmed.dateInvite : ACCEPTED_INVITE;
  const result = confirmDate(invite, "alice", "alice");
  assert.equal(result.success, true);
  assert.deepEqual(result.success && result.dateInvite.confirmedBy, ["alice"]);
});

test("confirmDate() allows an invite with no known recipient to still be confirmed by the sender", () => {
  const noRecipient: DateInvite = { ...ACCEPTED_INVITE, recipient: undefined };
  const result = confirmDate(noRecipient, "alice", "dave");
  assert.equal(result.success, true);
});

test("isFullyConfirmed() is false until both sender and recipient have confirmed", () => {
  assert.equal(isFullyConfirmed(ACCEPTED_INVITE, "alice"), false);
  const oneConfirmed: DateInvite = { ...ACCEPTED_INVITE, confirmedBy: ["alice"] };
  assert.equal(isFullyConfirmed(oneConfirmed, "alice"), false);
  const bothConfirmed: DateInvite = { ...ACCEPTED_INVITE, confirmedBy: ["alice", "bob"] };
  assert.equal(isFullyConfirmed(bothConfirmed, "alice"), true);
});

test("isFullyConfirmed() only needs the sender when there's no known recipient", () => {
  const noRecipient: DateInvite = { ...ACCEPTED_INVITE, recipient: undefined, confirmedBy: ["alice"] };
  assert.equal(isFullyConfirmed(noRecipient, "alice"), true);
});

test("isOverdueForConfirmation() is false before the proposed time arrives", () => {
  const before = new Date(ACCEPTED_INVITE.proposedAt).getTime() - 1000;
  assert.equal(isOverdueForConfirmation(ACCEPTED_INVITE, "alice", before), false);
});

test("isOverdueForConfirmation() is true once the proposed time has passed without full confirmation", () => {
  const after = new Date(ACCEPTED_INVITE.proposedAt).getTime() + 1000;
  assert.equal(isOverdueForConfirmation(ACCEPTED_INVITE, "alice", after), true);
});

test("isOverdueForConfirmation() is false once both parties have confirmed", () => {
  const bothConfirmed: DateInvite = { ...ACCEPTED_INVITE, confirmedBy: ["alice", "bob"] };
  const after = new Date(ACCEPTED_INVITE.proposedAt).getTime() + 1000;
  assert.equal(isOverdueForConfirmation(bothConfirmed, "alice", after), false);
});

test("isOverdueForConfirmation() is false for an invite with no known recipient", () => {
  const noRecipient: DateInvite = { ...ACCEPTED_INVITE, recipient: undefined };
  const after = new Date(ACCEPTED_INVITE.proposedAt).getTime() + 1000;
  assert.equal(isOverdueForConfirmation(noRecipient, "alice", after), false);
});

test("isOverdueForConfirmation() is false for a pending or declined invite", () => {
  const after = new Date(ACCEPTED_INVITE.proposedAt).getTime() + 1000;
  assert.equal(isOverdueForConfirmation({ ...ACCEPTED_INVITE, status: "pending" }, "alice", after), false);
  assert.equal(isOverdueForConfirmation({ ...ACCEPTED_INVITE, status: "declined" }, "alice", after), false);
});
