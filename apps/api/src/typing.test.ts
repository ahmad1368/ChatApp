import { test } from "node:test";
import assert from "node:assert/strict";
import { TypingStore } from "./typing";

test("getTypingAuthors() is empty before anything happens", () => {
  const store = new TypingStore();
  assert.deepEqual(store.getTypingAuthors("room-1"), []);
});

test("startTyping() adds the author to the room's typing set", () => {
  const store = new TypingStore();
  store.startTyping("room-1", "alice");
  assert.deepEqual(store.getTypingAuthors("room-1"), ["alice"]);
});

test("startTyping() twice for the same author does not duplicate", () => {
  const store = new TypingStore();
  store.startTyping("room-1", "alice");
  store.startTyping("room-1", "alice");
  assert.deepEqual(store.getTypingAuthors("room-1"), ["alice"]);
});

test("multiple authors can be typing in the same room", () => {
  const store = new TypingStore();
  store.startTyping("room-1", "alice");
  store.startTyping("room-1", "bob");
  assert.deepEqual(store.getTypingAuthors("room-1").sort(), ["alice", "bob"]);
});

test("stopTyping() removes only that author", () => {
  const store = new TypingStore();
  store.startTyping("room-1", "alice");
  store.startTyping("room-1", "bob");
  store.stopTyping("room-1", "alice");
  assert.deepEqual(store.getTypingAuthors("room-1"), ["bob"]);
});

test("stopTyping() for an author who isn't typing does not throw", () => {
  const store = new TypingStore();
  store.stopTyping("room-1", "alice");
  assert.deepEqual(store.getTypingAuthors("room-1"), []);
});

test("typing sets are independent per room", () => {
  const store = new TypingStore();
  store.startTyping("room-1", "alice");
  assert.deepEqual(store.getTypingAuthors("room-2"), []);
});

test("stopTypingEverywhere() clears an author from every room", () => {
  const store = new TypingStore();
  store.startTyping("room-1", "alice");
  store.startTyping("room-2", "alice");
  store.startTyping("room-2", "bob");
  store.stopTypingEverywhere("alice");
  assert.deepEqual(store.getTypingAuthors("room-1"), []);
  assert.deepEqual(store.getTypingAuthors("room-2"), ["bob"]);
});
