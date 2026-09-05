import { test } from "node:test";
import assert from "node:assert/strict";
import { BlockStore } from "./blocks";

test("block() records a block and rejects missing authors", () => {
  const store = new BlockStore();

  const result = store.block("alice", "bob");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.record.blockerAuthor, "alice");
    assert.equal(result.record.blockedAuthor, "bob");
  }

  const missing = store.block("alice", "");
  assert.equal(missing.success, false);
});

test("block() rejects blocking yourself", () => {
  const store = new BlockStore();
  const result = store.block("alice", "alice");
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error, /yourself/i);
  }
});

test("hasBlocked() is directional", () => {
  const store = new BlockStore();
  store.block("alice", "bob");
  assert.equal(store.hasBlocked("alice", "bob"), true);
  assert.equal(store.hasBlocked("bob", "alice"), false);
});

test("isMutuallyBlocked() is true regardless of who initiated the block", () => {
  const store = new BlockStore();
  store.block("alice", "bob");
  assert.equal(store.isMutuallyBlocked("alice", "bob"), true);
  assert.equal(store.isMutuallyBlocked("bob", "alice"), true);
  assert.equal(store.isMutuallyBlocked("alice", "carol"), false);
});

test("unblock() removes a block and reports whether one existed", () => {
  const store = new BlockStore();
  store.block("alice", "bob");
  assert.equal(store.unblock("alice", "bob"), true);
  assert.equal(store.isMutuallyBlocked("alice", "bob"), false);
  assert.equal(store.unblock("alice", "bob"), false);
});

test("getBlockedAuthors() lists only the blocker's own outgoing blocks", () => {
  const store = new BlockStore();
  store.block("alice", "bob");
  store.block("alice", "carol");
  store.block("dave", "alice");

  assert.deepEqual(store.getBlockedAuthors("alice").sort(), ["bob", "carol"]);
  assert.deepEqual(store.getBlockedAuthors("bob"), []);
});
