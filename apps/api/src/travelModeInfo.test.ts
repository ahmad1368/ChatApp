import { test } from "node:test";
import assert from "node:assert/strict";
import { TravelModeInfoStore, MAX_DESTINATION_LENGTH } from "./travelModeInfo";

test("get() returns inactive/empty before any update", () => {
  const store = new TravelModeInfoStore();
  assert.deepEqual(store.get("alice"), { active: false, destination: "" });
});

test("update() rejects a missing author", () => {
  const store = new TravelModeInfoStore();
  const result = store.update("", true, "Tokyo");
  assert.equal(result.success, false);
});

test("update() rejects a destination over the character limit", () => {
  const store = new TravelModeInfoStore();
  const result = store.update("alice", true, "a".repeat(MAX_DESTINATION_LENGTH + 1));
  assert.equal(result.success, false);
});

test("update() rejects a destination containing a phone number", () => {
  const store = new TravelModeInfoStore();
  const result = store.update("alice", true, "call me at 555-123-4567");
  assert.equal(result.success, false);
});

test("update() accepts an empty destination", () => {
  const store = new TravelModeInfoStore();
  const result = store.update("alice", true, "");
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { active: true, destination: "" });
});

test("update() accepts active with a destination, then get() returns it", () => {
  const store = new TravelModeInfoStore();
  const result = store.update("alice", true, "Tokyo, Japan");
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { active: true, destination: "Tokyo, Japan" });
});

test("updating again replaces the previous travel mode info for that author", () => {
  const store = new TravelModeInfoStore();
  store.update("alice", true, "Tokyo, Japan");
  store.update("alice", false, "");
  assert.deepEqual(store.get("alice"), { active: false, destination: "" });
});

test("each author's travel mode info is independent", () => {
  const store = new TravelModeInfoStore();
  store.update("alice", true, "Tokyo, Japan");
  assert.deepEqual(store.get("bob"), { active: false, destination: "" });
});
