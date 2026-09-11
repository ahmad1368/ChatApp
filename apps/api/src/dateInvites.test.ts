import { test } from "node:test";
import assert from "node:assert/strict";
import { createDateInvite, respondToDateInvite } from "./dateInvites";

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
