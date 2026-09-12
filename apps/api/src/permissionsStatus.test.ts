import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionsStatusStore } from "./permissionsStatus";

test("get() defaults every permission to prompt for a fresh author", () => {
  const store = new PermissionsStatusStore();
  assert.deepEqual(store.get("alice"), { location: "prompt", camera: "prompt", microphone: "prompt" });
});

test("report() rejects a missing author", () => {
  const store = new PermissionsStatusStore();
  const result = store.report("", "camera", "granted");
  assert.equal(result.success, false);
});

test("report() rejects an unknown permission type", () => {
  const store = new PermissionsStatusStore();
  const result = store.report("alice", "bluetooth", "granted");
  assert.equal(result.success, false);
});

test("report() rejects an unknown state", () => {
  const store = new PermissionsStatusStore();
  const result = store.report("alice", "camera", "maybe");
  assert.equal(result.success, false);
});

test("report() updates one permission and leaves the others at default", () => {
  const store = new PermissionsStatusStore();
  const result = store.report("alice", "camera", "granted");
  assert.deepEqual(result, { success: true, snapshot: { location: "prompt", camera: "granted", microphone: "prompt" } });
  assert.deepEqual(store.get("alice"), { location: "prompt", camera: "granted", microphone: "prompt" });
});

test("report() persists across multiple calls, merging rather than replacing", () => {
  const store = new PermissionsStatusStore();
  store.report("alice", "camera", "granted");
  store.report("alice", "location", "denied");
  assert.deepEqual(store.get("alice"), { location: "denied", camera: "granted", microphone: "prompt" });
});

test("snapshots are independent per author", () => {
  const store = new PermissionsStatusStore();
  store.report("alice", "microphone", "granted");
  assert.deepEqual(store.get("bob"), { location: "prompt", camera: "prompt", microphone: "prompt" });
});
