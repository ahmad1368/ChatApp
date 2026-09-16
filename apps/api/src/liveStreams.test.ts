import { test } from "node:test";
import assert from "node:assert/strict";
import { LiveStreamStore } from "./liveStreams";

test("start() rejects a missing broadcaster or title", () => {
  const store = new LiveStreamStore();
  assert.equal(store.start("", "My stream").success, false);
  assert.equal(store.start("alice", "").success, false);
});

test("start() rejects a broadcaster who is already live", () => {
  const store = new LiveStreamStore();
  store.start("alice", "First stream");
  const result = store.start("alice", "Second stream");
  assert.equal(result.success, false);
});

test("start() succeeds and the stream appears with zero viewers", () => {
  const store = new LiveStreamStore();
  const result = store.start("alice", "Q&A");
  assert.equal(result.success, true);
  const streams = store.listActiveStreams();
  assert.equal(streams.length, 1);
  assert.equal(streams[0].viewerCount, 0);
});

test("join() rejects an unknown stream or a missing viewer", () => {
  const store = new LiveStreamStore();
  assert.equal(store.join("bob", "nope").success, false);
  const { stream } = store.start("alice", "Q&A") as { success: true; stream: { id: string } };
  assert.equal(store.join("", stream.id).success, false);
});

test("join() rejects the broadcaster watching their own stream", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Q&A") as { success: true; stream: { id: string } };
  const result = store.join("alice", stream.id);
  assert.equal(result.success, false);
});

test("join() adds the viewer and getStream() lists them", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Q&A") as { success: true; stream: { id: string } };
  store.join("bob", stream.id);
  const details = store.getStream(stream.id);
  assert.deepEqual(details?.viewers, ["bob"]);
});

test("isFirstViewer() is true for the only viewer, false once a second joins", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Q&A") as { success: true; stream: { id: string } };
  store.join("bob", stream.id);
  assert.equal(store.isFirstViewer(stream.id, "bob"), true);
  store.join("carol", stream.id);
  assert.equal(store.isFirstViewer(stream.id, "bob"), false);
  assert.equal(store.isFirstViewer(stream.id, "carol"), false);
});

test("leave() removes a viewer without ending the stream", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Q&A") as { success: true; stream: { id: string } };
  store.join("bob", stream.id);
  const result = store.leave("bob", stream.id);
  assert.equal(result.success, true);
  assert.deepEqual(store.getStream(stream.id)?.viewers, []);
});

test("end() only allows the broadcaster to end their own stream", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Q&A") as { success: true; stream: { id: string } };
  assert.equal(store.end("bob", stream.id).success, false);
  assert.equal(store.end("alice", stream.id).success, true);
  assert.equal(store.getStream(stream.id), undefined);
});

test("postComment() rejects a non-participant", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Q&A") as { success: true; stream: { id: string } };
  const result = store.postComment("carol", stream.id, "hi");
  assert.equal(result.success, false);
});

test("postComment() allows the broadcaster and joined viewers", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Q&A") as { success: true; stream: { id: string } };
  store.join("bob", stream.id);
  assert.equal(store.postComment("alice", stream.id, "Welcome!").success, true);
  assert.equal(store.postComment("bob", stream.id, "Hi!").success, true);
  assert.equal(store.getComments(stream.id).length, 2);
});

test("postComment() rejects empty text and truncates overly long text", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Q&A") as { success: true; stream: { id: string } };
  assert.equal(store.postComment("alice", stream.id, "   ").success, false);
  store.postComment("alice", stream.id, "x".repeat(500));
  assert.equal(store.getComments(stream.id)[0].text.length, 300);
});

test("each stream's comments and viewers are independent", () => {
  const store = new LiveStreamStore();
  const { stream: streamA } = store.start("alice", "A") as { success: true; stream: { id: string } };
  const { stream: streamB } = store.start("dave", "B") as { success: true; stream: { id: string } };
  store.join("bob", streamA.id);
  store.postComment("bob", streamA.id, "hi");
  assert.equal(store.getComments(streamB.id).length, 0);
  assert.deepEqual(store.getStream(streamB.id)?.viewers, []);
});

test("start() rejects inviting yourself (#316)", () => {
  const store = new LiveStreamStore();
  const result = store.start("alice", "Private stream", "alice");
  assert.equal(result.success, false);
});

test("start() with an invitedViewer creates a private stream, excluded from the public list (#316)", () => {
  const store = new LiveStreamStore();
  const result = store.start("alice", "Just for bob", "bob");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.stream.invitedViewer, "bob");
  assert.deepEqual(store.listActiveStreams(), []);
});

test("listMyPrivateStreamInvites() surfaces a private stream only to the invited viewer (#316)", () => {
  const store = new LiveStreamStore();
  store.start("alice", "Just for bob", "bob");
  assert.equal(store.listMyPrivateStreamInvites("bob").length, 1);
  assert.deepEqual(store.listMyPrivateStreamInvites("carol"), []);
});

test("join() rejects a viewer who isn't the invited Match on a private stream (#316)", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Just for bob", "bob") as { success: true; stream: { id: string } };
  const result = store.join("carol", stream.id);
  assert.equal(result.success, false);
});

test("join() allows the invited Match on a private stream (#316)", () => {
  const store = new LiveStreamStore();
  const { stream } = store.start("alice", "Just for bob", "bob") as { success: true; stream: { id: string } };
  const result = store.join("bob", stream.id);
  assert.equal(result.success, true);
});

test("a public (non-invited) stream still appears in listActiveStreams() (#316)", () => {
  const store = new LiveStreamStore();
  store.start("alice", "Public stream");
  assert.equal(store.listActiveStreams().length, 1);
});
