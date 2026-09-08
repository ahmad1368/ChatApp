import { test } from "node:test";
import assert from "node:assert/strict";
import { searchMessages } from "./messageSearch";

const message = (id: string, text: string, deleted = false) => ({ id, text, deleted });

test("searchMessages() finds a case-insensitive substring match", () => {
  const messages = [message("1", "Hey, want to grab coffee?"), message("2", "See you at 5")];
  assert.deepEqual(searchMessages(messages, "COFFEE"), [messages[0]]);
});

test("searchMessages() returns an empty array for a blank query", () => {
  const messages = [message("1", "hello")];
  assert.deepEqual(searchMessages(messages, ""), []);
  assert.deepEqual(searchMessages(messages, "   "), []);
});

test("searchMessages() excludes deleted messages", () => {
  const messages = [message("1", "secret plan", true)];
  assert.deepEqual(searchMessages(messages, "secret"), []);
});

test("searchMessages() returns no matches when nothing contains the query", () => {
  const messages = [message("1", "hello"), message("2", "goodbye")];
  assert.deepEqual(searchMessages(messages, "coffee"), []);
});

test("searchMessages() preserves original order of matches", () => {
  const messages = [message("1", "coffee at 9"), message("2", "no match"), message("3", "coffee at 5")];
  assert.deepEqual(searchMessages(messages, "coffee"), [messages[0], messages[2]]);
});

test("searchMessages() matches an empty-text media message only against a non-empty query", () => {
  const messages = [message("1", "")];
  assert.deepEqual(searchMessages(messages, "photo"), []);
});
