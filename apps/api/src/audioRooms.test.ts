import test from "node:test";
import assert from "node:assert/strict";
import { AudioRoomStore } from "./audioRooms";

function createRoom(store: AudioRoomStore, overrides: Partial<{ title: string; description: string }> = {}) {
  return store.createRoom("host", { title: "Dating in your 30s", description: "A weekly discussion", ...overrides });
}

test("createRoom() rejects a missing host or title, and seats the host", () => {
  const store = new AudioRoomStore();
  assert.equal(store.createRoom("", { title: "t" }).success, false);
  assert.equal(createRoom(store, { title: "" }).success, false);

  const result = createRoom(store);
  assert.equal(result.success, true);
  if (!result.success) return;
  const details = store.getRoom(result.room.id)!;
  assert.deepEqual(details.speakers, ["host"]);
  assert.deepEqual(details.listeners, []);
});

test("listActiveRooms() reports speaker/listener counts", () => {
  const store = new AudioRoomStore();
  const created = createRoom(store);
  if (!created.success) return;
  const roomId = created.room.id;
  store.join("alice", roomId);
  store.join("bob", roomId);
  store.inviteToSpeak("host", roomId, "alice");

  const [summary] = store.listActiveRooms();
  assert.equal(summary.speakerCount, 2);
  assert.equal(summary.listenerCount, 1);
});

test("join() rejects an unknown room, a missing author, or joining twice", () => {
  const store = new AudioRoomStore();
  const created = createRoom(store);
  if (!created.success) return;
  const roomId = created.room.id;

  assert.equal(store.join("alice", "not-a-real-room").success, false);
  assert.equal(store.join("", roomId).success, false);
  assert.equal(store.join("alice", roomId).success, true);
  assert.equal(store.join("alice", roomId).success, false);
});

test("raiseHand() requires the author to be a listener in the room", () => {
  const store = new AudioRoomStore();
  const created = createRoom(store);
  if (!created.success) return;
  const roomId = created.room.id;

  assert.equal(store.raiseHand("alice", roomId).success, false);
  store.join("alice", roomId);
  assert.equal(store.raiseHand("alice", roomId).success, true);
  assert.ok(store.getRoom(roomId)!.raisedHands.includes("alice"));
  assert.equal(store.raiseHand("host", roomId).success, false);
});

test("inviteToSpeak() promotes a listener to speaker and clears their raised hand, host-only", () => {
  const store = new AudioRoomStore();
  const created = createRoom(store);
  if (!created.success) return;
  const roomId = created.room.id;
  store.join("alice", roomId);
  store.raiseHand("alice", roomId);

  assert.equal(store.inviteToSpeak("alice", roomId, "alice").success, false);
  const result = store.inviteToSpeak("host", roomId, "alice");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.ok(result.room.speakers.includes("alice"));
  assert.ok(!result.room.raisedHands.includes("alice"));

  assert.equal(store.inviteToSpeak("host", roomId, "alice").success, false);
});

test("moveToListener() demotes a speaker back to listener, host-only, and can't demote the host", () => {
  const store = new AudioRoomStore();
  const created = createRoom(store);
  if (!created.success) return;
  const roomId = created.room.id;
  store.join("alice", roomId);
  store.inviteToSpeak("host", roomId, "alice");

  assert.equal(store.moveToListener("alice", roomId, "alice").success, false);
  assert.equal(store.moveToListener("host", roomId, "host").success, false);

  const result = store.moveToListener("host", roomId, "alice");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.ok(result.room.listeners.includes("alice"));
});

test("leave() promotes the longest-standing speaker to host when the host leaves", () => {
  const store = new AudioRoomStore();
  const created = createRoom(store);
  if (!created.success) return;
  const roomId = created.room.id;
  store.join("alice", roomId);
  store.inviteToSpeak("host", roomId, "alice");

  const result = store.leave("host", roomId);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.ended, false);
  assert.equal(result.newHost, "alice");
  assert.equal(store.getRoom(roomId)!.host, "alice");
});

test("leave() ends the room when the host leaves and no speakers remain", () => {
  const store = new AudioRoomStore();
  const created = createRoom(store);
  if (!created.success) return;
  const roomId = created.room.id;
  store.join("alice", roomId);

  const result = store.leave("host", roomId);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.ended, true);
  assert.equal(store.getRoom(roomId), undefined);
});

test("leave() rejects an unknown room or an author not in the room", () => {
  const store = new AudioRoomStore();
  const created = createRoom(store);
  if (!created.success) return;
  assert.equal(store.leave("alice", "not-a-real-room").success, false);
  assert.equal(store.leave("alice", created.room.id).success, false);
});

test("endRoom() closes the room, host-only", () => {
  const store = new AudioRoomStore();
  const created = createRoom(store);
  if (!created.success) return;
  const roomId = created.room.id;

  assert.equal(store.endRoom("not-host", roomId).success, false);
  assert.equal(store.endRoom("host", roomId).success, true);
  assert.equal(store.getRoom(roomId), undefined);
});
