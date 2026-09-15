import test from "node:test";
import assert from "node:assert/strict";
import { ForumStore } from "./forums";

function createHub(store: ForumStore, overrides: Partial<{ name: string; description: string }> = {}) {
  return store.createHub("alice", { name: "Hiking Club", description: "For trail lovers", ...overrides });
}

test("createHub() rejects a missing creator or name, and auto-joins the creator", () => {
  const store = new ForumStore();
  assert.equal(store.createHub("", { name: "x" }).success, false);
  assert.equal(createHub(store, { name: "" }).success, false);

  const result = createHub(store);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.hub.createdBy, "alice");
  assert.equal(store.isMember(result.hub.id, "alice"), true);
});

test("listHubs() reports member and thread counts", () => {
  const store = new ForumStore();
  const created = createHub(store);
  if (!created.success) return;
  const hubId = created.hub.id;
  store.joinHub("bob", hubId);
  store.createThread("alice", hubId, { title: "t", body: "b" });

  const summary = store.getHub(hubId)!;
  assert.equal(summary.memberCount, 2);
  assert.equal(summary.threadCount, 1);
});

test("joinHub() and leaveHub() track membership and reject an unknown hub", () => {
  const store = new ForumStore();
  const created = createHub(store);
  if (!created.success) return;
  const hubId = created.hub.id;

  assert.equal(store.joinHub("bob", "not-a-real-hub").success, false);
  const joined = store.joinHub("bob", hubId);
  assert.equal(joined.success, true);
  if (joined.success) assert.equal(joined.memberCount, 2);
  assert.equal(store.isMember(hubId, "bob"), true);

  const left = store.leaveHub("bob", hubId);
  assert.equal(left.success, true);
  if (left.success) assert.equal(left.memberCount, 1);
  assert.equal(store.isMember(hubId, "bob"), false);

  assert.equal(store.leaveHub("bob", hubId).success, false);
});

test("createThread() requires hub membership and rejects missing title/body", () => {
  const store = new ForumStore();
  const created = createHub(store);
  if (!created.success) return;
  const hubId = created.hub.id;

  assert.equal(store.createThread("bob", hubId, { title: "t", body: "b" }).success, false);
  assert.equal(store.createThread("alice", "not-a-real-hub", { title: "t", body: "b" }).success, false);
  assert.equal(store.createThread("alice", hubId, { title: "", body: "b" }).success, false);
  assert.equal(store.createThread("alice", hubId, { title: "t", body: "" }).success, false);

  const thread = store.createThread("alice", hubId, { title: "Best trails?", body: "Recommend one" });
  assert.equal(thread.success, true);
});

test("listThreads() sorts by most recent reply activity, falling back to thread creation", async () => {
  const store = new ForumStore();
  const created = createHub(store);
  if (!created.success) return;
  const hubId = created.hub.id;

  const first = store.createThread("alice", hubId, { title: "First", body: "b" });
  const second = store.createThread("alice", hubId, { title: "Second", body: "b" });
  if (!first.success || !second.success) return;

  await new Promise((r) => setTimeout(r, 2));
  store.createReply("alice", first.thread.id, { body: "bump" });

  const threads = store.listThreads(hubId);
  assert.equal(threads[0].title, "First");
  assert.equal(threads[0].replyCount, 1);
});

test("createReply() requires hub membership and rejects an unknown thread or empty body", () => {
  const store = new ForumStore();
  const created = createHub(store);
  if (!created.success) return;
  const hubId = created.hub.id;
  const thread = store.createThread("alice", hubId, { title: "t", body: "b" });
  if (!thread.success) return;
  const threadId = thread.thread.id;

  assert.equal(store.createReply("bob", threadId, { body: "hi" }).success, false);
  assert.equal(store.createReply("alice", "not-a-real-thread", { body: "hi" }).success, false);
  assert.equal(store.createReply("alice", threadId, { body: "" }).success, false);

  const reply = store.createReply("alice", threadId, { body: "Great question!" });
  assert.equal(reply.success, true);

  const details = store.getThread(threadId)!;
  assert.equal(details.replies.length, 1);
  assert.equal(details.replies[0].body, "Great question!");
});

test("getHub() and getThread() return undefined for unknown ids", () => {
  const store = new ForumStore();
  assert.equal(store.getHub("nope"), undefined);
  assert.equal(store.getThread("nope"), undefined);
});
