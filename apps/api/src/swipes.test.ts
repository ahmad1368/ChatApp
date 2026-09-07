import { test } from "node:test";
import assert from "node:assert/strict";
import { SwipeStore } from "./swipes";

const NEVER_BLOCKED = () => false;
const NO_COMPATIBILITY = () => 0;
const NEVER_BOOSTED = () => false;

function names(candidates: { author: string }[]): string[] {
  return candidates.map((c) => c.author);
}

test("joinDiscovery() rejects a missing author", () => {
  const store = new SwipeStore();
  const result = store.joinDiscovery("");
  assert.equal(result.success, false);
});

test("getCandidates() excludes the author themselves", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  assert.deepEqual(names(store.getCandidates("alice", NEVER_BLOCKED)), []);
});

test("getCandidates() returns other joined authors", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  store.joinDiscovery("carol");
  assert.deepEqual(names(store.getCandidates("alice", NEVER_BLOCKED)).sort(), ["bob", "carol"]);
});

test("getCandidates() excludes authors already swiped on", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  store.joinDiscovery("carol");
  store.recordSwipe("alice", "bob", "pass");
  assert.deepEqual(names(store.getCandidates("alice", NEVER_BLOCKED)), ["carol"]);
});

test("getCandidates() excludes authors blocked either way", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  const isBlocked = (a: string, b: string) => (a === "alice" && b === "bob") || (a === "bob" && b === "alice");
  assert.deepEqual(names(store.getCandidates("alice", isBlocked)), []);
});

test("getCandidates() respects the limit", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  for (let i = 0; i < 20; i++) store.joinDiscovery(`user${i}`);
  assert.equal(store.getCandidates("alice", NEVER_BLOCKED, NO_COMPATIBILITY, NEVER_BOOSTED, 5).length, 5);
});

test("getCandidates() includes each candidate's compatibility score from the injected scorer", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  const scorer = (a: string, b: string) => (a === "alice" && b === "bob" ? 42 : 0);
  assert.deepEqual(store.getCandidates("alice", NEVER_BLOCKED, scorer), [{ author: "bob", compatibility: 42 }]);
});

test("getCandidates() ranks higher-compatibility candidates first among non-superlikers", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  store.joinDiscovery("carol");
  const scorer = (a: string, b: string) => (b === "carol" ? 90 : 10);
  assert.deepEqual(names(store.getCandidates("alice", NEVER_BLOCKED, scorer)), ["carol", "bob"]);
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
  assert.deepEqual(names(store.getCandidates("alice", NEVER_BLOCKED)), []);

  const result = store.undoLastSwipe("alice");
  assert.equal(result.success, true);
  assert.equal(result.success && result.swiped, "bob");
  assert.deepEqual(names(store.getCandidates("alice", NEVER_BLOCKED)), ["bob"]);
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
  assert.deepEqual(names(store.getCandidates("alice", NEVER_BLOCKED)), ["carol", "bob"]);
});

test("getLikedBy() returns an empty list when nobody has liked this author", () => {
  const store = new SwipeStore();
  assert.deepEqual(store.getLikedBy("alice", NEVER_BLOCKED), []);
});

test("getLikedBy() includes an author who liked but was not swiped back", () => {
  const store = new SwipeStore();
  store.recordSwipe("bob", "alice", "like");
  assert.deepEqual(names(store.getLikedBy("alice", NEVER_BLOCKED)), ["bob"]);
});

test("getLikedBy() excludes a pass", () => {
  const store = new SwipeStore();
  store.recordSwipe("bob", "alice", "pass");
  assert.deepEqual(store.getLikedBy("alice", NEVER_BLOCKED), []);
});

test("getLikedBy() excludes someone once the author has swiped back on them", () => {
  const store = new SwipeStore();
  store.recordSwipe("bob", "alice", "like");
  store.recordSwipe("alice", "bob", "pass");
  assert.deepEqual(store.getLikedBy("alice", NEVER_BLOCKED), []);
});

test("getLikedBy() excludes a mutual match (already swiped back with a like)", () => {
  const store = new SwipeStore();
  store.recordSwipe("bob", "alice", "like");
  store.recordSwipe("alice", "bob", "like");
  assert.deepEqual(store.getLikedBy("alice", NEVER_BLOCKED), []);
});

test("getLikedBy() excludes a blocked author", () => {
  const store = new SwipeStore();
  store.recordSwipe("bob", "alice", "like");
  const isBlocked = (a: string, b: string) => a === "bob" || b === "bob";
  assert.deepEqual(store.getLikedBy("alice", isBlocked), []);
});

test("getLikedBy() surfaces superlikers first, then ranks by compatibility", () => {
  const store = new SwipeStore();
  store.recordSwipe("bob", "alice", "like");
  store.recordSwipe("carol", "alice", "superlike");
  assert.deepEqual(names(store.getLikedBy("alice", NEVER_BLOCKED)), ["carol", "bob"]);
});

test("getLikedBy() includes each liker's compatibility score", () => {
  const store = new SwipeStore();
  store.recordSwipe("bob", "alice", "like");
  const scorer = (a: string, b: string) => (a === "alice" && b === "bob" ? 75 : 0);
  assert.deepEqual(store.getLikedBy("alice", NEVER_BLOCKED, scorer), [{ author: "bob", compatibility: 75 }]);
});

test("getCandidates() ranks a boosted candidate ahead of a non-boosted one", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  store.joinDiscovery("carol");
  const isBoosted = (candidate: string) => candidate === "carol";
  assert.deepEqual(names(store.getCandidates("alice", NEVER_BLOCKED, NO_COMPATIBILITY, isBoosted)), ["carol", "bob"]);
});

test("getCandidates() still ranks a superliker ahead of a boosted candidate", () => {
  const store = new SwipeStore();
  store.joinDiscovery("alice");
  store.joinDiscovery("bob");
  store.joinDiscovery("carol");
  store.recordSwipe("bob", "alice", "superlike");
  const isBoosted = (candidate: string) => candidate === "carol";
  assert.deepEqual(names(store.getCandidates("alice", NEVER_BLOCKED, NO_COMPATIBILITY, isBoosted)), ["bob", "carol"]);
});
