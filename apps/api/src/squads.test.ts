import { test } from "node:test";
import assert from "node:assert/strict";
import { SquadStore, MIN_SQUAD_SIZE, MAX_SQUAD_SIZE } from "./squads";

test("createSquad() rejects fewer than the minimum members", () => {
  const store = new SquadStore();
  const result = store.createSquad(["alice"]);
  assert.equal(result.success, false);
});

test("createSquad() rejects more than the maximum members", () => {
  const store = new SquadStore();
  const result = store.createSquad(Array.from({ length: MAX_SQUAD_SIZE + 1 }, (_, i) => `user${i}`));
  assert.equal(result.success, false);
});

test("createSquad() accepts exactly the minimum number of members", () => {
  const store = new SquadStore();
  const result = store.createSquad(["alice", "bob"]);
  assert.equal(result.success, true);
  assert.equal(result.success && result.squad.members.length, MIN_SQUAD_SIZE);
});

test("createSquad() rejects duplicate members", () => {
  const store = new SquadStore();
  const result = store.createSquad(["alice", "alice"]);
  assert.equal(result.success, false);
});

test("createSquad() rejects a member already in another squad", () => {
  const store = new SquadStore();
  store.createSquad(["alice", "bob"]);
  const result = store.createSquad(["alice", "carol"]);
  assert.equal(result.success, false);
});

test("getSquadForAuthor() returns the squad a member belongs to", () => {
  const store = new SquadStore();
  const created = store.createSquad(["alice", "bob"]);
  assert.equal(created.success, true);
  const squad = store.getSquadForAuthor("alice");
  assert.ok(squad);
  assert.equal(squad!.id, created.success ? created.squad.id : undefined);
});

test("getSquadForAuthor() returns null for someone not in a squad", () => {
  const store = new SquadStore();
  assert.equal(store.getSquadForAuthor("alice"), null);
});

test("disbandSquad() rejects a non-member", () => {
  const store = new SquadStore();
  const created = store.createSquad(["alice", "bob"]);
  const squadId = created.success ? created.squad.id : "";
  const result = store.disbandSquad(squadId, "carol");
  assert.equal(result.success, false);
});

test("disbandSquad() frees members to join a new squad", () => {
  const store = new SquadStore();
  const created = store.createSquad(["alice", "bob"]);
  const squadId = created.success ? created.squad.id : "";
  store.disbandSquad(squadId, "alice");
  assert.equal(store.getSquadForAuthor("alice"), null);
  const recreated = store.createSquad(["alice", "carol"]);
  assert.equal(recreated.success, true);
});

test("getCandidates() excludes a squad itself and squads not in discovery", () => {
  const store = new SquadStore();
  const a = store.createSquad(["alice", "bob"]);
  const b = store.createSquad(["carol", "dave"]);
  const squadA = a.success ? a.squad.id : "";
  const squadB = b.success ? b.squad.id : "";
  store.joinDiscovery(squadA);
  assert.deepEqual(store.getCandidates(squadA), []);
  store.joinDiscovery(squadB);
  assert.deepEqual(store.getCandidates(squadA), [squadB]);
});

test("recordSwipe() rejects a squad swiping on itself", () => {
  const store = new SquadStore();
  const a = store.createSquad(["alice", "bob"]);
  const squadA = a.success ? a.squad.id : "";
  const result = store.recordSwipe(squadA, squadA, "like");
  assert.equal(result.success, false);
});

test("recordSwipe() rejects an unknown squad", () => {
  const store = new SquadStore();
  const a = store.createSquad(["alice", "bob"]);
  const squadA = a.success ? a.squad.id : "";
  const result = store.recordSwipe(squadA, "nonexistent", "like");
  assert.equal(result.success, false);
});

test("recordSwipe() rejects swiping on the same squad twice", () => {
  const store = new SquadStore();
  const a = store.createSquad(["alice", "bob"]);
  const b = store.createSquad(["carol", "dave"]);
  const squadA = a.success ? a.squad.id : "";
  const squadB = b.success ? b.squad.id : "";
  store.recordSwipe(squadA, squadB, "pass");
  const result = store.recordSwipe(squadA, squadB, "like");
  assert.equal(result.success, false);
});

test("recordSwipe() with a one-sided like does not create a group match", () => {
  const store = new SquadStore();
  const a = store.createSquad(["alice", "bob"]);
  const b = store.createSquad(["carol", "dave"]);
  const squadA = a.success ? a.squad.id : "";
  const squadB = b.success ? b.squad.id : "";
  const result = store.recordSwipe(squadA, squadB, "like");
  assert.equal(result.success, true);
  assert.equal(result.success && result.matched, false);
});

test("recordSwipe() with mutual likes creates a group match with a shared room for both squads", () => {
  const store = new SquadStore();
  const a = store.createSquad(["alice", "bob"]);
  const b = store.createSquad(["carol", "dave"]);
  const squadA = a.success ? a.squad.id : "";
  const squadB = b.success ? b.squad.id : "";

  store.recordSwipe(squadA, squadB, "like");
  const result = store.recordSwipe(squadB, squadA, "like");
  assert.equal(result.success, true);
  assert.equal(result.success && result.matched, true);
  const roomId = result.success ? result.roomId : undefined;
  assert.ok(roomId);

  assert.deepEqual(store.getGroupMatches(squadA), [{ squadId: squadB, roomId }]);
  assert.deepEqual(store.getGroupMatches(squadB), [{ squadId: squadA, roomId }]);
});

test("recordSwipe() with a pass never creates a group match even if the other liked", () => {
  const store = new SquadStore();
  const a = store.createSquad(["alice", "bob"]);
  const b = store.createSquad(["carol", "dave"]);
  const squadA = a.success ? a.squad.id : "";
  const squadB = b.success ? b.squad.id : "";

  store.recordSwipe(squadA, squadB, "like");
  const result = store.recordSwipe(squadB, squadA, "pass");
  assert.equal(result.success, true);
  assert.equal(result.success && result.matched, false);
  assert.deepEqual(store.getGroupMatches(squadA), []);
});

test("getGroupMatches() returns an empty list before any match", () => {
  const store = new SquadStore();
  const a = store.createSquad(["alice", "bob"]);
  const squadA = a.success ? a.squad.id : "";
  assert.deepEqual(store.getGroupMatches(squadA), []);
});
