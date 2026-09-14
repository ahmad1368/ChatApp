import test from "node:test";
import assert from "node:assert/strict";
import { SpeedDatingStore, generateRoundRobinRounds, SPEED_DATING_WEEKDAY_UTC, SPEED_DATING_HOUR_UTC } from "./speedDating";

test("generateRoundRobinRounds() pairs every participant with every other exactly once (even count)", () => {
  const rounds = generateRoundRobinRounds(["a", "b", "c", "d"]);
  const seen = new Set<string>();
  for (const round of rounds) {
    for (const [x, y] of round) {
      seen.add([x, y].sort().join("|"));
    }
  }
  assert.equal(seen.size, 6); // C(4,2)
  assert.equal(rounds.length, 3); // n-1 rounds
});

test("generateRoundRobinRounds() gives each participant exactly one bye per round with an odd count", () => {
  const rounds = generateRoundRobinRounds(["a", "b", "c"]);
  for (const round of rounds) {
    const inRound = round.flat();
    assert.equal(inRound.length, 2); // one pair, one player sits out
  }
});

test("generateRoundRobinRounds() returns no rounds for fewer than 2 participants", () => {
  assert.deepEqual(generateRoundRobinRounds([]), []);
  assert.deepEqual(generateRoundRobinRounds(["a"]), []);
});

test("getNextSession() lands on the configured weekday and hour, in the future", () => {
  const store = new SpeedDatingStore();
  const now = Date.now();
  const session = store.getNextSession(now);
  const date = new Date(session.startsAt);
  assert.equal(date.getUTCDay(), SPEED_DATING_WEEKDAY_UTC);
  assert.equal(date.getUTCHours(), SPEED_DATING_HOUR_UTC);
  assert.ok(date.getTime() > now);
});

test("join() rejects a missing author and adds a real author to the next session's participant list", () => {
  const store = new SpeedDatingStore();
  assert.equal(store.join("").success, false);
  const result = store.join("alice");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.session.participants, ["alice"]);
});

test("join() is idempotent: joining twice doesn't duplicate the participant", () => {
  const store = new SpeedDatingStore();
  store.join("alice");
  const second = store.join("alice");
  if (!second.success) return;
  assert.deepEqual(second.session.participants, ["alice"]);
});

test("generateRounds() rejects an unknown session and fewer than 2 participants", () => {
  const store = new SpeedDatingStore();
  assert.equal(store.generateRounds("not-a-real-session").success, false);

  const now = Date.now();
  store.join("alice", now);
  const sessionKey = store.getNextSession(now).sessionKey;
  assert.equal(store.generateRounds(sessionKey).success, false);
});

test("generateRounds() succeeds with 2+ participants and is cached on repeat calls", () => {
  const store = new SpeedDatingStore();
  const now = Date.now();
  store.join("alice", now);
  store.join("bob", now);
  const sessionKey = store.getNextSession(now).sessionKey;
  const first = store.generateRounds(sessionKey);
  assert.equal(first.success, true);
  const second = store.generateRounds(sessionKey);
  assert.deepEqual(second, first);
});

test("expressInterest() rejects a pair that was never actually matched in a round", () => {
  const store = new SpeedDatingStore();
  const now = Date.now();
  store.join("alice", now);
  store.join("bob", now);
  const sessionKey = store.getNextSession(now).sessionKey;
  store.generateRounds(sessionKey);
  assert.equal(store.expressInterest(sessionKey, "alice", "carol").success, false);
});

test("expressInterest() is one-sided until mutual, then both sides show a match", () => {
  const store = new SpeedDatingStore();
  const now = Date.now();
  store.join("alice", now);
  store.join("bob", now);
  const sessionKey = store.getNextSession(now).sessionKey;
  store.generateRounds(sessionKey);

  const aliceInterest = store.expressInterest(sessionKey, "alice", "bob");
  assert.equal(aliceInterest.success, true);
  if (aliceInterest.success) assert.equal(aliceInterest.matched, false);
  assert.deepEqual(store.getMatches(sessionKey, "alice"), []);

  const bobInterest = store.expressInterest(sessionKey, "bob", "alice");
  assert.equal(bobInterest.success, true);
  if (bobInterest.success) assert.equal(bobInterest.matched, true);
  assert.deepEqual(store.getMatches(sessionKey, "alice"), ["bob"]);
  assert.deepEqual(store.getMatches(sessionKey, "bob"), ["alice"]);
});
