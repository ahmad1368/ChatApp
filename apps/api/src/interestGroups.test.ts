import test from "node:test";
import assert from "node:assert/strict";
import { InterestGroupStore } from "./interestGroups";

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function createGroup(store: InterestGroupStore, overrides: Partial<{ name: string; description: string }> = {}) {
  return store.createGroup("alice", { name: "Hiking Group", description: "Weekend trail hikes", ...overrides });
}

test("createGroup() rejects a missing creator or name, and auto-joins the creator", () => {
  const store = new InterestGroupStore();
  assert.equal(store.createGroup("", { name: "x" }).success, false);
  assert.equal(createGroup(store, { name: "" }).success, false);

  const result = createGroup(store);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(store.isMember(result.group.id, "alice"), true);
});

test("listGroups() and getGroup() report member counts", () => {
  const store = new InterestGroupStore();
  const created = createGroup(store);
  if (!created.success) return;
  const groupId = created.group.id;
  store.join("bob", groupId);

  assert.equal(store.listGroups()[0].memberCount, 2);
  const details = store.getGroup(groupId)!;
  assert.equal(details.memberCount, 2);
  assert.deepEqual(new Set(details.members), new Set(["alice", "bob"]));
});

test("join() and leave() track membership and reject an unknown group", () => {
  const store = new InterestGroupStore();
  const created = createGroup(store);
  if (!created.success) return;
  const groupId = created.group.id;

  assert.equal(store.join("bob", "not-a-real-group").success, false);
  assert.equal(store.join("bob", groupId).success, true);
  assert.equal(store.isMember(groupId, "bob"), true);

  const left = store.leave("bob", groupId);
  assert.equal(left.success, true);
  if (left.success) assert.equal(left.memberCount, 1);
  assert.equal(store.leave("bob", groupId).success, false);
});

test("createActivity() requires group membership and validates fields", () => {
  const store = new InterestGroupStore();
  const created = createGroup(store);
  if (!created.success) return;
  const groupId = created.group.id;

  assert.equal(store.createActivity("bob", groupId, { title: "t", startsAt: futureDate, capacity: 5 }).success, false);
  assert.equal(store.createActivity("alice", "not-a-real-group", { title: "t", startsAt: futureDate, capacity: 5 }).success, false);
  assert.equal(store.createActivity("alice", groupId, { title: "", startsAt: futureDate, capacity: 5 }).success, false);
  assert.equal(store.createActivity("alice", groupId, { title: "t", startsAt: "bad-date", capacity: 5 }).success, false);
  assert.equal(store.createActivity("alice", groupId, { title: "t", startsAt: futureDate, capacity: 0 }).success, false);

  const result = store.createActivity("alice", groupId, { title: "Saturday hike", startsAt: futureDate, capacity: 5 });
  assert.equal(result.success, true);
});

test("listActivities() only returns this group's upcoming activities, soonest first", () => {
  const store = new InterestGroupStore();
  const groupA = createGroup(store, { name: "Hiking" });
  const groupB = createGroup(store, { name: "Cycling" });
  if (!groupA.success || !groupB.success) return;

  const soon = new Date(Date.now() + 60_000).toISOString();
  const later = new Date(Date.now() + 120_000).toISOString();
  store.createActivity("alice", groupA.group.id, { title: "Later hike", startsAt: later, capacity: 5 });
  store.createActivity("alice", groupA.group.id, { title: "Soon hike", startsAt: soon, capacity: 5 });
  store.createActivity("alice", groupB.group.id, { title: "Bike ride", startsAt: soon, capacity: 5 });

  const activities = store.listActivities(groupA.group.id);
  assert.equal(activities.length, 2);
  assert.equal(activities[0].title, "Soon hike");
});

test("rsvp() requires group membership, confirms up to capacity then waitlists, and cancelRsvp() promotes from the waitlist", () => {
  const store = new InterestGroupStore();
  const created = createGroup(store);
  if (!created.success) return;
  const groupId = created.group.id;
  const activity = store.createActivity("alice", groupId, { title: "Hike", startsAt: futureDate, capacity: 1 });
  if (!activity.success) return;
  const activityId = activity.activity.id;

  assert.equal(store.rsvp("carol", activityId).success, false);

  store.join("bob", groupId);
  const first = store.rsvp("alice", activityId);
  assert.equal(first.success, true);
  if (first.success) assert.equal(first.status, "confirmed");

  const second = store.rsvp("bob", activityId);
  assert.equal(second.success, true);
  if (second.success) assert.equal(second.status, "waitlisted");

  store.cancelRsvp("alice", activityId);
  const details = store.getActivity(activityId)!;
  assert.deepEqual(details.confirmedAttendees, ["bob"]);
  assert.deepEqual(details.waitlist, []);
});

test("rsvp() rejects an unknown activity, a missing author, and a duplicate RSVP", () => {
  const store = new InterestGroupStore();
  const created = createGroup(store);
  if (!created.success) return;
  const activity = store.createActivity("alice", created.group.id, { title: "Hike", startsAt: futureDate, capacity: 5 });
  if (!activity.success) return;

  assert.equal(store.rsvp("alice", "not-a-real-activity").success, false);
  assert.equal(store.rsvp("", activity.activity.id).success, false);
  store.rsvp("alice", activity.activity.id);
  assert.equal(store.rsvp("alice", activity.activity.id).success, false);
});

test("cancelRsvp() rejects an unknown activity and an author who never RSVP'd", () => {
  const store = new InterestGroupStore();
  const created = createGroup(store);
  if (!created.success) return;
  const activity = store.createActivity("alice", created.group.id, { title: "Hike", startsAt: futureDate, capacity: 5 });
  if (!activity.success) return;

  assert.equal(store.cancelRsvp("alice", "not-a-real-activity").success, false);
  assert.equal(store.cancelRsvp("alice", activity.activity.id).success, false);
});

test("getGroup() and getActivity() return undefined for unknown ids", () => {
  const store = new InterestGroupStore();
  assert.equal(store.getGroup("nope"), undefined);
  assert.equal(store.getActivity("nope"), undefined);
});
