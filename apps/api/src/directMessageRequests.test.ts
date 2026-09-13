import test from "node:test";
import assert from "node:assert/strict";
import { DirectMessageRequestStore, validateDirectMessageRequest } from "./directMessageRequests";

test("validateDirectMessageRequest() catches the same problems send() would, without persisting anything", () => {
  assert.equal(validateDirectMessageRequest("", "bob", "hi").valid, false);
  assert.equal(validateDirectMessageRequest("alice", "", "hi").valid, false);
  assert.equal(validateDirectMessageRequest("alice", "alice", "hi").valid, false);
  assert.equal(validateDirectMessageRequest("alice", "bob", "").valid, false);
  assert.equal(validateDirectMessageRequest("alice", "bob", "x".repeat(501)).valid, false);

  const result = validateDirectMessageRequest(" alice ", " bob ", " hi ");
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result, { valid: true, from: "alice", to: "bob", text: "hi" });
});

test("send() rejects a missing from/to, self-send, or missing/overlong text", () => {
  const store = new DirectMessageRequestStore();
  assert.equal(store.send("", "bob", "hi").success, false);
  assert.equal(store.send("alice", "", "hi").success, false);
  assert.equal(store.send("alice", "alice", "hi").success, false);
  assert.equal(store.send("alice", "bob", "").success, false);
  assert.equal(store.send("alice", "bob", "x".repeat(501)).success, false);
});

test("send() succeeds and the request appears in the recipient's inbox", () => {
  const store = new DirectMessageRequestStore();
  const result = store.send("alice", "bob", "Hey, I'd love to chat!");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.request.status, "pending");
  assert.deepEqual(
    store.getInbox("bob").map((r) => r.id),
    [result.request.id]
  );
});

test("getInbox() never includes another author's requests", () => {
  const store = new DirectMessageRequestStore();
  store.send("alice", "bob", "hi bob");
  assert.deepEqual(store.getInbox("carol"), []);
});

test("respond() rejects an unknown request, a non-recipient, or a missing/invalid accept flag", () => {
  const store = new DirectMessageRequestStore();
  const result = store.send("alice", "bob", "hi");
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(store.respond("does-not-exist", "bob", true).success, false);
  assert.equal(store.respond(result.request.id, "carol", true).success, false);
  assert.equal(store.respond(result.request.id, "bob", "yes" as unknown as boolean).success, false);
});

test("respond() accepting marks the request accepted and removes it from the pending inbox", () => {
  const store = new DirectMessageRequestStore();
  const sent = store.send("alice", "bob", "hi");
  assert.equal(sent.success, true);
  if (!sent.success) return;

  const result = store.respond(sent.request.id, "bob", true);
  assert.equal(result.success, true);
  assert.equal(result.success && result.request.status, "accepted");
  assert.deepEqual(store.getInbox("bob"), []);
});

test("respond() declining marks the request declined and removes it from the pending inbox", () => {
  const store = new DirectMessageRequestStore();
  const sent = store.send("alice", "bob", "hi");
  assert.equal(sent.success, true);
  if (!sent.success) return;

  const result = store.respond(sent.request.id, "bob", false);
  assert.equal(result.success, true);
  assert.equal(result.success && result.request.status, "declined");
  assert.deepEqual(store.getInbox("bob"), []);
});

test("respond() rejects responding to an already-responded request", () => {
  const store = new DirectMessageRequestStore();
  const sent = store.send("alice", "bob", "hi");
  assert.equal(sent.success, true);
  if (!sent.success) return;
  store.respond(sent.request.id, "bob", true);
  const second = store.respond(sent.request.id, "bob", false);
  assert.equal(second.success, false);
});

test("getInbox() returns newest first", () => {
  const store = new DirectMessageRequestStore();
  const first = store.send("alice", "bob", "first");
  const second = store.send("carol", "bob", "second");
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  if (!first.success || !second.success) return;
  assert.deepEqual(
    store.getInbox("bob").map((r) => r.id),
    [second.request.id, first.request.id]
  );
});
