import { test } from "node:test";
import assert from "node:assert/strict";
import { createPoll, voteOnPoll } from "./chatPoll";

test("createPoll() rejects a missing creator or recipient", () => {
  assert.equal(createPoll("", "bob", "Cinema or dinner?", ["Cinema", "Dinner"]).success, false);
  assert.equal(createPoll("alice", "", "Cinema or dinner?", ["Cinema", "Dinner"]).success, false);
});

test("createPoll() rejects creating a poll with yourself", () => {
  const result = createPoll("alice", "alice", "Cinema or dinner?", ["Cinema", "Dinner"]);
  assert.equal(result.success, false);
});

test("createPoll() rejects a missing question", () => {
  const result = createPoll("alice", "bob", "", ["Cinema", "Dinner"]);
  assert.equal(result.success, false);
});

test("createPoll() rejects an overly long question", () => {
  const result = createPoll("alice", "bob", "x".repeat(201), ["Cinema", "Dinner"]);
  assert.equal(result.success, false);
});

test("createPoll() rejects too few or too many options", () => {
  assert.equal(createPoll("alice", "bob", "Q?", ["Only one"]).success, false);
  assert.equal(createPoll("alice", "bob", "Q?", ["A", "B", "C", "D", "E"]).success, false);
});

test("createPoll() rejects a blank option", () => {
  const result = createPoll("alice", "bob", "Q?", ["Cinema", "   "]);
  assert.equal(result.success, false);
});

test("createPoll() rejects an overly long option", () => {
  const result = createPoll("alice", "bob", "Q?", ["Cinema", "x".repeat(81)]);
  assert.equal(result.success, false);
});

test("createPoll() rejects duplicate options (case-insensitive)", () => {
  const result = createPoll("alice", "bob", "Q?", ["Cinema", "cinema"]);
  assert.equal(result.success, false);
});

test("createPoll() succeeds with valid input and starts with no votes", () => {
  const result = createPoll("alice", "bob", "Cinema or dinner?", ["Cinema", "Dinner"]);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.poll.question, "Cinema or dinner?");
  assert.equal(result.poll.options.length, 2);
  assert.deepEqual(result.poll.votes, {});
  assert.equal(result.poll.creator, "alice");
  assert.equal(result.poll.recipient, "bob");
});

test("voteOnPoll() rejects a voter who isn't the creator or recipient", () => {
  const created = createPoll("alice", "bob", "Q?", ["A", "B"]);
  assert.equal(created.success, true);
  if (!created.success) return;
  const result = voteOnPoll(created.poll, "mallory", created.poll.options[0].id);
  assert.equal(result.success, false);
});

test("voteOnPoll() rejects an invalid optionId", () => {
  const created = createPoll("alice", "bob", "Q?", ["A", "B"]);
  assert.equal(created.success, true);
  if (!created.success) return;
  const result = voteOnPoll(created.poll, "alice", "not-a-real-option");
  assert.equal(result.success, false);
});

test("voteOnPoll() records the creator's and recipient's votes independently", () => {
  const created = createPoll("alice", "bob", "Q?", ["A", "B"]);
  assert.equal(created.success, true);
  if (!created.success) return;
  const afterAlice = voteOnPoll(created.poll, "alice", created.poll.options[0].id);
  assert.equal(afterAlice.success, true);
  if (!afterAlice.success) return;
  const afterBob = voteOnPoll(afterAlice.poll, "bob", created.poll.options[1].id);
  assert.equal(afterBob.success, true);
  if (!afterBob.success) return;
  assert.deepEqual(afterBob.poll.votes, { alice: created.poll.options[0].id, bob: created.poll.options[1].id });
});

test("voteOnPoll() replaces a previous vote rather than stacking it", () => {
  const created = createPoll("alice", "bob", "Q?", ["A", "B"]);
  assert.equal(created.success, true);
  if (!created.success) return;
  const first = voteOnPoll(created.poll, "alice", created.poll.options[0].id);
  assert.equal(first.success, true);
  if (!first.success) return;
  const second = voteOnPoll(first.poll, "alice", created.poll.options[1].id);
  assert.equal(second.success, true);
  if (!second.success) return;
  assert.deepEqual(second.poll.votes, { alice: created.poll.options[1].id });
});
