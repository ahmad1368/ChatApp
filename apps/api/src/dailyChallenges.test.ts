import test from "node:test";
import assert from "node:assert/strict";
import { DailyChallengeStore, DAILY_CHALLENGES } from "./dailyChallenges";

test("getStatus() starts every challenge at zero progress, incomplete and unclaimed", () => {
  const store = new DailyChallengeStore();
  const status = store.getStatus("alice");
  assert.equal(status.length, DAILY_CHALLENGES.length);
  assert.ok(status.every((c) => c.progress === 0 && !c.completed && !c.rewardClaimed));
});

test("incrementProgress() accumulates and marks completed once the target is reached", () => {
  const store = new DailyChallengeStore();
  const messages = DAILY_CHALLENGES.find((c) => c.id === "messages")!;
  for (let i = 0; i < messages.target - 1; i++) store.incrementProgress("alice", "messages");
  let status = store.getStatus("alice").find((c) => c.id === "messages")!;
  assert.equal(status.progress, messages.target - 1);
  assert.equal(status.completed, false);

  store.incrementProgress("alice", "messages");
  status = store.getStatus("alice").find((c) => c.id === "messages")!;
  assert.equal(status.progress, messages.target);
  assert.equal(status.completed, true);
});

test("incrementProgress() never exceeds the target or reopens a completed challenge", () => {
  const store = new DailyChallengeStore();
  const messages = DAILY_CHALLENGES.find((c) => c.id === "messages")!;
  for (let i = 0; i < messages.target + 5; i++) store.incrementProgress("alice", "messages");
  const status = store.getStatus("alice").find((c) => c.id === "messages")!;
  assert.equal(status.progress, messages.target);
});

test("incrementProgress() ignores a missing author or unknown challenge id", () => {
  const store = new DailyChallengeStore();
  store.incrementProgress("", "messages");
  store.incrementProgress("alice", "not-a-real-challenge");
  assert.deepEqual(store.getStatus("alice").find((c) => c.id === "messages"), {
    ...DAILY_CHALLENGES.find((c) => c.id === "messages")!,
    progress: 0,
    completed: false,
    rewardClaimed: false,
  });
});

test("setProgress() sets an absolute level and never decreases it", () => {
  const store = new DailyChallengeStore();
  store.setProgress("alice", "prompt-answers", 2);
  store.setProgress("alice", "prompt-answers", 1);
  const status = store.getStatus("alice").find((c) => c.id === "prompt-answers")!;
  assert.equal(status.progress, 2);
});

test("claimReward() rejects an incomplete challenge and an unknown challenge id", () => {
  const store = new DailyChallengeStore();
  assert.equal(store.claimReward("alice", "messages").success, false);
  assert.equal(store.claimReward("alice", "not-a-real-challenge").success, false);
});

test("claimReward() succeeds once completed and rejects a second claim", () => {
  const store = new DailyChallengeStore();
  const messages = DAILY_CHALLENGES.find((c) => c.id === "messages")!;
  for (let i = 0; i < messages.target; i++) store.incrementProgress("alice", "messages");

  const first = store.claimReward("alice", "messages");
  assert.equal(first.success, true);
  if (first.success) assert.equal(first.coinReward, messages.coinReward);

  const second = store.claimReward("alice", "messages");
  assert.equal(second.success, false);
});

test("each author's progress is independent", () => {
  const store = new DailyChallengeStore();
  store.incrementProgress("alice", "messages");
  const bobStatus = store.getStatus("bob").find((c) => c.id === "messages")!;
  assert.equal(bobStatus.progress, 0);
});
