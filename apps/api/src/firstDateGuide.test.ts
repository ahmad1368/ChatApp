import test from "node:test";
import assert from "node:assert/strict";
import { listTopics, getTopic, ask, FIRST_DATE_ADVICE_TOPICS } from "./firstDateGuide";

test("listTopics() returns the full real catalog", () => {
  const topics = listTopics();
  assert.equal(topics.length, FIRST_DATE_ADVICE_TOPICS.length);
  assert.ok(topics.every((t) => t.advice.length > 0));
});

test("getTopic() returns a topic by id and undefined for an unknown id", () => {
  assert.equal(getTopic("safety")?.title, "How do I stay safe?");
  assert.equal(getTopic("not-a-real-topic"), undefined);
});

test("ask() matches a free-text question to the right topic by keyword overlap", () => {
  const result = ask("Where should we meet up for the first date?");
  assert.equal(result.topic?.id, "where-to-meet");
  assert.deepEqual(result.suggestedTopics, []);
});

test("ask() matches nervousness questions", () => {
  const result = ask("I'm really nervous about this, any advice?");
  assert.equal(result.topic?.id, "nervous");
});

test("ask() matches safety questions", () => {
  const result = ask("How can I stay safe on a first date?");
  assert.equal(result.topic?.id, "safety");
});

test("ask() falls back to the full topic list for an unmatched question, rather than guessing", () => {
  const result = ask("What's the capital of France?");
  assert.equal(result.topic, null);
  assert.equal(result.suggestedTopics.length, FIRST_DATE_ADVICE_TOPICS.length);
});

test("ask() falls back for an empty question", () => {
  const result = ask("");
  assert.equal(result.topic, null);
  assert.ok(result.suggestedTopics.length > 0);
});
