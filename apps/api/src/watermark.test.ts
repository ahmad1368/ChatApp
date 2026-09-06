import { test } from "node:test";
import assert from "node:assert/strict";
import { WatermarkStore } from "./watermark";

test("issueTraceCode() returns a session with a unique trace code", () => {
  const store = new WatermarkStore();
  const first = store.issueTraceCode("alice", "general");
  const second = store.issueTraceCode("alice", "general");

  assert.ok(first);
  assert.ok(second);
  assert.equal(first?.author, "alice");
  assert.equal(first?.roomId, "general");
  assert.notEqual(first?.traceCode, second?.traceCode);
});

test("issueTraceCode() rejects missing author or roomId", () => {
  const store = new WatermarkStore();
  assert.equal(store.issueTraceCode("", "general"), undefined);
  assert.equal(store.issueTraceCode("alice", ""), undefined);
});

test("lookup() resolves a trace code back to its session", () => {
  const store = new WatermarkStore();
  const session = store.issueTraceCode("alice", "general");
  assert.ok(session);
  const found = store.lookup(session!.traceCode);
  assert.deepEqual(found, session);
});

test("lookup() returns undefined for an unknown trace code", () => {
  const store = new WatermarkStore();
  assert.equal(store.lookup("does-not-exist"), undefined);
});
