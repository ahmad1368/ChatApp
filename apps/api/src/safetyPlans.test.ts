import { test } from "node:test";
import assert from "node:assert/strict";
import { SafetyPlanStore } from "./safetyPlans";

const VALID_PAYLOAD = {
  meetingWith: "Jordan",
  location: "Blue Bottle Coffee, Market St",
  scheduledAt: "2026-09-10T18:00:00.000Z",
};

test("create() records a plan and issues a share code", () => {
  const store = new SafetyPlanStore();
  const result = store.create("alice", VALID_PAYLOAD);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.plan.author, "alice");
    assert.equal(result.plan.meetingWith, "Jordan");
    assert.ok(result.plan.shareCode);
  }
});

test("create() rejects missing author, meetingWith, or location", () => {
  const store = new SafetyPlanStore();
  assert.equal(store.create("", VALID_PAYLOAD).success, false);
  assert.equal(store.create("alice", { ...VALID_PAYLOAD, meetingWith: "" }).success, false);
  assert.equal(store.create("alice", { ...VALID_PAYLOAD, location: "" }).success, false);
});

test("create() rejects an invalid or missing scheduledAt", () => {
  const store = new SafetyPlanStore();
  assert.equal(store.create("alice", { ...VALID_PAYLOAD, scheduledAt: "not-a-date" }).success, false);
  assert.equal(store.create("alice", { ...VALID_PAYLOAD, scheduledAt: "" }).success, false);
});

test("getByShareCode() returns the plan for a valid code, without exposing internal ids", () => {
  const store = new SafetyPlanStore();
  const created = store.create("alice", VALID_PAYLOAD);
  assert.equal(created.success, true);
  if (!created.success) return;

  const view = store.getByShareCode(created.plan.shareCode);
  assert.ok(view);
  assert.equal(view?.author, "alice");
  assert.equal(view?.meetingWith, "Jordan");
  assert.equal((view as unknown as { id?: string }).id, undefined);
});

test("getByShareCode() returns undefined for an unknown code", () => {
  const store = new SafetyPlanStore();
  assert.equal(store.getByShareCode("does-not-exist"), undefined);
});
