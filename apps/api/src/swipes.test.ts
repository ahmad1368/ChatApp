import { test } from "node:test";
import assert from "node:assert/strict";
import { SwipeStore } from "./swipes";

const NEVER_BLOCKED = () => false;

test("joinDiscovery() rejects a missing author", () => {
  const store = new SwipeStore();
  const result = store.joinDiscovery("");
  assert.equal(result.success, false);
});

test("getCandidates() excludes the author themselves", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  assert.deepEqual(store.getCandidates("alice", NEVER_BLOCKED), []);
});

test("getCandidates() returns other joined authors", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  store.joinDiscovery("carol");
  assert.deepEqual(store.getCandidates("alice", NEVER_BLOCKED).sort(), ["bob", "carol"]);
});

test("getCandidates() excludes authors already swiped on", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  store.joinDiscovery("carol");
  store.recordSwipe("alice", "bob", "pass");
  assert.deepEqual(store.getCandidates("alice", NEVER_BLOCKED), ["carol"]);
});

test("getCandidates() excludes authors blocked either way", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  const isBlocked = (a: string, b: string) => (a === "alice" && b === "bob") || (a === "bob" && b === "alice");
  assert.deepEqual(store.getCandidates("alice", isBlocked), []);
});

test("getCandidates() respects the limit", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  for (let i = 0; i < 20; i++) store.joinDiscovery(`user${i}`);
  assert.equal(store.getCandidates("alice", NEVER_BLOCKED, 5).length, 5);
});

test("recordSwipe() rejects missing swiper or swiped", () => {
  const store = new SwipeStore();
  const result = store.recordSwipe("", "bob", "like");
  assert.equal(result.success, false);
});

test("recordSwipe() rejects swiping on yourself", () => {
  const store = new SwipeStore();
  const result = store.recordSwipe("alice", "alice", "like");
  assert.equal(result.success, false);
});

test("recordSwipe() rejects an invalid direction", () => {
  const store = new SwipeStore();
  const result = store.recordSwipe("alice", "bob", "superduperlike");
  assert.equal(result.success, false);
});

test("recordSwipe() rejects swiping on the same profile twice", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "pass");
  const result = store.recordSwipe("alice", "bob", "like");
  assert.equal(result.success, false);
});

test("recordSwipe() with a one-sided like does not create a match", () => {
  const store = new SwipeStore();
  const result = store.recordSwipe("alice", "bob", "like");
  assert.equal(result.success, true);
  assert.equal(result.success && result.matched, false);
  assert.deepEqual(store.getMatches("alice"), []);
  assert.deepEqual(store.getMatches("bob"), []);
});

test("recordSwipe() with mutual likes creates a match for both authors", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "like");
  const result = store.recordSwipe("bob", "alice", "like");
  assert.equal(result.success, true);
  assert.equal(result.success && result.matched, true);
  assert.deepEqual(store.getMatches("alice"), ["bob"]);
  assert.deepEqual(store.getMatches("bob"), ["alice"]);
});

test("recordSwipe() with a pass never creates a match even if the other liked", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "like");
  const result = store.recordSwipe("bob", "alice", "pass");
  assert.equal(result.success, true);
  assert.equal(result.success && result.matched, false);
  assert.deepEqual(store.getMatches("alice"), []);
});

test("getMatches() returns an empty list for an author with no matches", () => {
  const store = new SwipeStore();
  assert.deepEqual(store.getMatches("alice"), []);
});

test("undoLastSwipe() rejects a missing author", () => {
  const store = new SwipeStore();
  const result = store.undoLastSwipe("");
  assert.equal(result.success, false);
});

test("undoLastSwipe() rejects when there's nothing to undo", () => {
  const store = new SwipeStore();
  const result = store.undoLastSwipe("alice");
  assert.equal(result.success, false);
});

test("undoLastSwipe() undoes a pass and makes the candidate swipeable again", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  store.recordSwipe("alice", "bob", "pass");
  assert.deepEqual(store.getCandidates("alice", NEVER_BLOCKED), []);

  const result = store.undoLastSwipe("alice");
  assert.equal(result.success, true);
  assert.equal(result.success && result.swiped, "bob");
  assert.deepEqual(store.getCandidates("alice", NEVER_BLOCKED), ["bob"]);
});

test("undoLastSwipe() lets the swiper swipe on that candidate again afterward", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "pass");
  store.undoLastSwipe("alice");
  const result = store.recordSwipe("alice", "bob", "like");
  assert.equal(result.success, true);
});

test("undoLastSwipe() revokes a match that swipe had just created, on both sides", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "like");
  store.recordSwipe("bob", "alice", "like");
  assert.deepEqual(store.getMatches("alice"), ["bob"]);
  assert.deepEqual(store.getMatches("bob"), ["alice"]);

  const result = store.undoLastSwipe("bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getMatches("alice"), []);
  assert.deepEqual(store.getMatches("bob"), []);
});

test("undoLastSwipe() can only undo once in a row (not a full history)", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "pass");
  store.undoLastSwipe("alice");
  const result = store.undoLastSwipe("alice");
  assert.equal(result.success, false);
});

test("undoLastSwipe() only undoes the swiper's own last swipe, not the other side's", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "like");
  store.recordSwipe("bob", "alice", "like");
  store.undoLastSwipe("alice");
  // Bob's own swipe on alice is untouched.
  const result = store.recordSwipe("bob", "alice", "pass");
  assert.equal(result.success, false);
});

test("recordSwipe() accepts a superlike direction", () => {
  const store = new SwipeStore();
  const result = store.recordSwipe("alice", "bob", "superlike");
  assert.equal(result.success, true);
});

test("recordSwipe() rejects a second superlike beyond the daily limit", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "superlike");
  const result = store.recordSwipe("alice", "carol", "superlike");
  assert.equal(result.success, false);
});

test("recordSwipe() still allows an ordinary like after using today's superlike", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "superlike");
  const result = store.recordSwipe("alice", "carol", "like");
  assert.equal(result.success, true);
});

test("recordSwipe() matches a superlike against a mutual ordinary like", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "superlike");
  const result = store.recordSwipe("bob", "alice", "like");
  assert.equal(result.success, true);
  assert.equal(result.success && result.matched, true);
});

test("recordSwipe() matches mutual superlikes", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "superlike");
  const result = store.recordSwipe("bob", "alice", "superlike");
  assert.equal(result.success, true);
  assert.equal(result.success && result.matched, true);
});

test("getSuperLikesRemainingToday() starts at the daily limit and decreases after use", () => {
  const store = new SwipeStore();
  assert.equal(store.getSuperLikesRemainingToday("alice"), 1);
  store.recordSwipe("alice", "bob", "superlike");
  assert.equal(store.getSuperLikesRemainingToday("alice"), 0);
});

test("undoLastSwipe() refunds a superlike so it can be used again", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "superlike");
  assert.equal(store.getSuperLikesRemainingToday("alice"), 0);
  store.undoLastSwipe("alice");
  assert.equal(store.getSuperLikesRemainingToday("alice"), 1);

  const result = store.recordSwipe("alice", "carol", "superlike");
  assert.equal(result.success, true);
});

test("undoLastSwipe() does not refund anything for a non-superlike undo", () => {
  const store = new SwipeStore();
  store.recordSwipe("alice", "bob", "superlike");
  store.recordSwipe("alice", "carol", "pass");
  store.undoLastSwipe("alice");
  assert.equal(store.getSuperLikesRemainingToday("alice"), 0);
});

test("getCandidates() surfaces authors who superliked this author first", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  store.joinDiscovery("carol");
  store.recordSwipe("carol", "alice", "superlike");
  assert.deepEqual(store.getCandidates("alice", NEVER_BLOCKED), ["carol", "bob"]);
});
