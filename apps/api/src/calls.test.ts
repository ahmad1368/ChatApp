import { test } from "node:test";
import assert from "node:assert/strict";
import { CallStore } from "./calls";

test("initiate() rejects a missing roomId", () => {
  const store = new CallStore();
  const result = store.initiate("", "alice", "bob");
  assert.deepEqual(result, { success: false, error: "roomId is required" });
});

test("initiate() rejects a missing caller or callee", () => {
  const store = new CallStore();
  assert.equal(store.initiate("room-1", "", "bob").success, false);
  assert.equal(store.initiate("room-1", "alice", "").success, false);
});

test("initiate() rejects calling yourself", () => {
  const store = new CallStore();
  const result = store.initiate("room-1", "alice", "alice");
  assert.deepEqual(result, { success: false, error: "Cannot call yourself" });
});

test("initiate() creates a ringing, non-video call by default", () => {
  const store = new CallStore();
  const result = store.initiate("room-1", "alice", "bob");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.call.roomId, "room-1");
    assert.equal(result.call.caller, "alice");
    assert.equal(result.call.callee, "bob");
    assert.equal(result.call.status, "ringing");
    assert.equal(result.call.video, false);
    assert.ok(result.call.id.length > 0);
  }
});

test("initiate() creates a video call when requested (#129)", () => {
  const store = new CallStore();
  const result = store.initiate("room-1", "alice", "bob", true);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.call.video, true);
  }
});

test("initiate() rejects when the caller is already in a call", () => {
  const store = new CallStore();
  store.initiate("room-1", "alice", "bob");
  const result = store.initiate("room-1", "alice", "carol");
  assert.deepEqual(result, { success: false, error: "You're already in a call" });
});

test("initiate() rejects when the callee is already in a call", () => {
  const store = new CallStore();
  store.initiate("room-1", "alice", "bob");
  const result = store.initiate("room-1", "carol", "bob");
  assert.deepEqual(result, { success: false, error: "This person is already in a call" });
});

test("accept() rejects an unknown call", () => {
  const store = new CallStore();
  const result = store.accept("unknown", "bob");
  assert.equal(result.success, false);
});

test("accept() rejects when the caller tries to accept their own call", () => {
  const store = new CallStore();
  const initiated = store.initiate("room-1", "alice", "bob");
  assert.equal(initiated.success, true);
  if (!initiated.success) return;
  const result = store.accept(initiated.call.id, "alice");
  assert.deepEqual(result, { success: false, error: "Only the callee can accept this call" });
});

test("accept() moves a ringing call to active", () => {
  const store = new CallStore();
  const initiated = store.initiate("room-1", "alice", "bob");
  assert.equal(initiated.success, true);
  if (!initiated.success) return;
  const result = store.accept(initiated.call.id, "bob");
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.call.status, "active");
});

test("accept() rejects accepting a call twice", () => {
  const store = new CallStore();
  const initiated = store.initiate("room-1", "alice", "bob");
  assert.equal(initiated.success, true);
  if (!initiated.success) return;
  store.accept(initiated.call.id, "bob");
  const result = store.accept(initiated.call.id, "bob");
  assert.deepEqual(result, { success: false, error: "Call is not ringing" });
});

test("end() rejects an unknown call", () => {
  const store = new CallStore();
  const result = store.end("unknown", "alice");
  assert.equal(result.success, false);
});

test("end() rejects a non-participant", () => {
  const store = new CallStore();
  const initiated = store.initiate("room-1", "alice", "bob");
  assert.equal(initiated.success, true);
  if (!initiated.success) return;
  const result = store.end(initiated.call.id, "carol");
  assert.deepEqual(result, { success: false, error: "You're not a participant in this call" });
});

test("end() removes the call, freeing both participants for a new one", () => {
  const store = new CallStore();
  const initiated = store.initiate("room-1", "alice", "bob");
  assert.equal(initiated.success, true);
  if (!initiated.success) return;
  const result = store.end(initiated.call.id, "bob");
  assert.equal(result.success, true);
  assert.equal(store.get(initiated.call.id), undefined);
  assert.equal(store.getActiveCallFor("alice"), undefined);
  assert.equal(store.getActiveCallFor("bob"), undefined);

  const reinitiated = store.initiate("room-1", "alice", "bob");
  assert.equal(reinitiated.success, true);
});

test("getActiveCallFor() finds a call by either participant", () => {
  const store = new CallStore();
  const initiated = store.initiate("room-1", "alice", "bob");
  assert.equal(initiated.success, true);
  if (!initiated.success) return;
  assert.equal(store.getActiveCallFor("alice")?.id, initiated.call.id);
  assert.equal(store.getActiveCallFor("bob")?.id, initiated.call.id);
});

test("getActiveCallFor() is undefined for someone not in a call", () => {
  const store = new CallStore();
  store.initiate("room-1", "alice", "bob");
  assert.equal(store.getActiveCallFor("carol"), undefined);
});

test("get() returns undefined for an unknown call", () => {
  const store = new CallStore();
  assert.equal(store.get("unknown"), undefined);
});
