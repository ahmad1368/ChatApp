import test from "node:test";
import assert from "node:assert/strict";
import { DailyPollStore, getTodaysPoll } from "./dailyPolls";

test("getTodaysPoll() returns a real question with at least two options", () => {
  const poll = getTodaysPoll();
  assert.ok(poll.question.length > 0);
  assert.ok(poll.options.length >= 2);
});

test("getStatus() shows no vote and zero results before voting", () => {
  const store = new DailyPollStore();
  const status = store.getStatus("alice");
  assert.equal(status.myVote, null);
  assert.equal(status.totalVotes, 0);
  assert.ok(status.results.every((r) => r.votes === 0 && r.percentage === 0));
});

test("vote() rejects a missing author or an unknown option id", () => {
  const store = new DailyPollStore();
  const poll = getTodaysPoll();
  assert.equal(store.vote("", poll.options[0].id).success, false);
  assert.equal(store.vote("alice", "not-a-real-option").success, false);
});

test("vote() records the vote and updates the aggregate results", () => {
  const store = new DailyPollStore();
  const poll = getTodaysPoll();
  const result = store.vote("alice", poll.options[0].id);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.status.myVote, poll.options[0].id);
  assert.equal(result.status.totalVotes, 1);
  const votedOption = result.status.results.find((r) => r.id === poll.options[0].id);
  assert.equal(votedOption?.votes, 1);
  assert.equal(votedOption?.percentage, 100);
});

test("vote() rejects a second vote from the same author the same day", () => {
  const store = new DailyPollStore();
  const poll = getTodaysPoll();
  store.vote("alice", poll.options[0].id);
  const second = store.vote("alice", poll.options[1].id);
  assert.equal(second.success, false);
});

test("results reflect percentages across multiple voters", () => {
  const store = new DailyPollStore();
  const poll = getTodaysPoll();
  store.vote("alice", poll.options[0].id);
  store.vote("bob", poll.options[0].id);
  store.vote("carol", poll.options[1].id);
  const status = store.getStatus("alice");
  assert.equal(status.totalVotes, 3);
  const first = status.results.find((r) => r.id === poll.options[0].id);
  const second = status.results.find((r) => r.id === poll.options[1].id);
  assert.equal(first?.votes, 2);
  assert.equal(first?.percentage, 67);
  assert.equal(second?.votes, 1);
  assert.equal(second?.percentage, 33);
});

test("each author's own vote is tracked independently", () => {
  const store = new DailyPollStore();
  const poll = getTodaysPoll();
  store.vote("alice", poll.options[0].id);
  const bobStatus = store.getStatus("bob");
  assert.equal(bobStatus.myVote, null);
  assert.equal(bobStatus.totalVotes, 1);
});
