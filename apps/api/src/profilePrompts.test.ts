import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfilePromptsStore, PROFILE_PROMPT_CATALOG, MAX_SELECTED_PROMPTS, MAX_ANSWER_LENGTH } from "./profilePrompts";

const PROMPT_A = PROFILE_PROMPT_CATALOG[0].id;
const PROMPT_B = PROFILE_PROMPT_CATALOG[1].id;
const PROMPT_C = PROFILE_PROMPT_CATALOG[2].id;
const PROMPT_D = PROFILE_PROMPT_CATALOG[3].id;

test("getAnswers() returns an empty list before any update", () => {
  const store = new ProfilePromptsStore();
  assert.deepEqual(store.getAnswers("alice"), []);
});

test("setAnswers() rejects a missing author", () => {
  const store = new ProfilePromptsStore();
  const result = store.setAnswers("", [{ promptId: PROMPT_A, answer: "Something fun" }]);
  assert.equal(result.success, false);
});

test("setAnswers() rejects an empty list", () => {
  const store = new ProfilePromptsStore();
  const result = store.setAnswers("alice", []);
  assert.equal(result.success, false);
});

test("setAnswers() rejects more than the max number of prompts", () => {
  const store = new ProfilePromptsStore();
  const result = store.setAnswers("alice", [
    { promptId: PROMPT_A, answer: "A" },
    { promptId: PROMPT_B, answer: "B" },
    { promptId: PROMPT_C, answer: "C" },
    { promptId: PROMPT_D, answer: "D" },
  ]);
  assert.equal(result.success, false);
  assert.equal(MAX_SELECTED_PROMPTS, 3);
});

test("setAnswers() rejects an unknown prompt id", () => {
  const store = new ProfilePromptsStore();
  const result = store.setAnswers("alice", [{ promptId: "not-a-real-prompt", answer: "Hello" }]);
  assert.equal(result.success, false);
});

test("setAnswers() rejects selecting the same prompt twice", () => {
  const store = new ProfilePromptsStore();
  const result = store.setAnswers("alice", [
    { promptId: PROMPT_A, answer: "First answer" },
    { promptId: PROMPT_A, answer: "Second answer" },
  ]);
  assert.equal(result.success, false);
});

test("setAnswers() rejects an empty answer", () => {
  const store = new ProfilePromptsStore();
  const result = store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "   " }]);
  assert.equal(result.success, false);
});

test("setAnswers() rejects an answer over the character limit", () => {
  const store = new ProfilePromptsStore();
  const result = store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "a".repeat(MAX_ANSWER_LENGTH + 1) }]);
  assert.equal(result.success, false);
});

test("setAnswers() rejects an answer containing a phone number", () => {
  const store = new ProfilePromptsStore();
  const result = store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "text me at 555-123-4567" }]);
  assert.equal(result.success, false);
});

test("setAnswers() accepts valid answers and resolves prompt text", () => {
  const store = new ProfilePromptsStore();
  const result = store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "Loves hiking" }]);
  assert.equal(result.success, true);
  const answers = store.getAnswers("alice");
  assert.equal(answers.length, 1);
  assert.equal(answers[0].promptId, PROMPT_A);
  assert.equal(answers[0].answer, "Loves hiking");
  assert.equal(answers[0].prompt, PROFILE_PROMPT_CATALOG[0].text);
});

test("setAnswers() replaces the previous set of answers for that author", () => {
  const store = new ProfilePromptsStore();
  store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "First set" }]);
  store.setAnswers("alice", [{ promptId: PROMPT_B, answer: "Second set" }]);
  const answers = store.getAnswers("alice");
  assert.equal(answers.length, 1);
  assert.equal(answers[0].promptId, PROMPT_B);
});

test("each author's prompt answers are independent", () => {
  const store = new ProfilePromptsStore();
  store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "Alice's answer" }]);
  assert.deepEqual(store.getAnswers("bob"), []);
});

test("getPinnedPromptId() returns null before any pin", () => {
  const store = new ProfilePromptsStore();
  assert.equal(store.getPinnedPromptId("alice"), null);
});

test("setPinnedPrompt() rejects a missing author", () => {
  const store = new ProfilePromptsStore();
  const result = store.setPinnedPrompt("", PROMPT_A);
  assert.equal(result.success, false);
});

test("setPinnedPrompt() rejects a prompt the author hasn't answered", () => {
  const store = new ProfilePromptsStore();
  store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "A" }]);
  const result = store.setPinnedPrompt("alice", PROMPT_B);
  assert.equal(result.success, false);
  assert.equal(store.getPinnedPromptId("alice"), null);
});

test("setPinnedPrompt() accepts one of the author's answered prompts", () => {
  const store = new ProfilePromptsStore();
  store.setAnswers("alice", [
    { promptId: PROMPT_A, answer: "A" },
    { promptId: PROMPT_B, answer: "B" },
  ]);
  const result = store.setPinnedPrompt("alice", PROMPT_B);
  assert.equal(result.success, true);
  assert.equal(store.getPinnedPromptId("alice"), PROMPT_B);
});

test("getAnswers() sorts the pinned answer first, keeping the rest in order", () => {
  const store = new ProfilePromptsStore();
  store.setAnswers("alice", [
    { promptId: PROMPT_A, answer: "A" },
    { promptId: PROMPT_B, answer: "B" },
    { promptId: PROMPT_C, answer: "C" },
  ]);
  store.setPinnedPrompt("alice", PROMPT_C);
  const answers = store.getAnswers("alice");
  assert.deepEqual(
    answers.map((a) => a.promptId),
    [PROMPT_C, PROMPT_A, PROMPT_B]
  );
});

test("setPinnedPrompt() with null unpins", () => {
  const store = new ProfilePromptsStore();
  store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "A" }]);
  store.setPinnedPrompt("alice", PROMPT_A);
  const result = store.setPinnedPrompt("alice", null);
  assert.equal(result.success, true);
  assert.equal(store.getPinnedPromptId("alice"), null);
});

test("re-answering prompts clears a pin that's no longer in the new set", () => {
  const store = new ProfilePromptsStore();
  store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "A" }]);
  store.setPinnedPrompt("alice", PROMPT_A);
  store.setAnswers("alice", [{ promptId: PROMPT_B, answer: "B" }]);
  assert.equal(store.getPinnedPromptId("alice"), null);
});

test("re-answering prompts keeps a pin that's still in the new set", () => {
  const store = new ProfilePromptsStore();
  store.setAnswers("alice", [
    { promptId: PROMPT_A, answer: "A" },
    { promptId: PROMPT_B, answer: "B" },
  ]);
  store.setPinnedPrompt("alice", PROMPT_A);
  store.setAnswers("alice", [
    { promptId: PROMPT_A, answer: "A updated" },
    { promptId: PROMPT_C, answer: "C" },
  ]);
  assert.equal(store.getPinnedPromptId("alice"), PROMPT_A);
});

test("each author's pinned prompt is independent", () => {
  const store = new ProfilePromptsStore();
  store.setAnswers("alice", [{ promptId: PROMPT_A, answer: "A" }]);
  store.setPinnedPrompt("alice", PROMPT_A);
  assert.equal(store.getPinnedPromptId("bob"), null);
});
