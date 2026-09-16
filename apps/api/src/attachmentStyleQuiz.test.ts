import { test } from "node:test";
import assert from "node:assert/strict";
import { AttachmentStyleStore, ATTACHMENT_QUIZ_QUESTIONS } from "./attachmentStyleQuiz";

const N = ATTACHMENT_QUIZ_QUESTIONS.length;

function answersWith(anxiety: number, avoidance: number): number[] {
  return ATTACHMENT_QUIZ_QUESTIONS.map((q) => (q.dimension === "anxiety" ? anxiety : avoidance));
}

test("submitQuiz rejects a missing author", () => {
  const store = new AttachmentStyleStore();
  const result = store.submitQuiz("", answersWith(1, 1), false);
  assert.equal(result.success, false);
});

test("submitQuiz rejects the wrong number of answers", () => {
  const store = new AttachmentStyleStore();
  const result = store.submitQuiz("alice", [1, 2, 3], false);
  assert.equal(result.success, false);
});

test("submitQuiz rejects an out-of-range answer", () => {
  const store = new AttachmentStyleStore();
  const answers = answersWith(1, 1);
  answers[0] = 6;
  const result = store.submitQuiz("alice", answers, false);
  assert.equal(result.success, false);
});

test("submitQuiz rejects a non-integer answer", () => {
  const store = new AttachmentStyleStore();
  const answers = answersWith(1, 1);
  answers[0] = 2.5;
  const result = store.submitQuiz("alice", answers, false);
  assert.equal(result.success, false);
});

test("low anxiety and low avoidance classifies as secure", () => {
  const store = new AttachmentStyleStore();
  const result = store.submitQuiz("alice", answersWith(1, 1), false);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.result.style, "secure");
});

test("high anxiety and low avoidance classifies as anxious", () => {
  const store = new AttachmentStyleStore();
  const result = store.submitQuiz("alice", answersWith(5, 1), false);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.result.style, "anxious");
});

test("low anxiety and high avoidance classifies as avoidant", () => {
  const store = new AttachmentStyleStore();
  const result = store.submitQuiz("alice", answersWith(1, 5), false);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.result.style, "avoidant");
});

test("high anxiety and high avoidance classifies as fearful", () => {
  const store = new AttachmentStyleStore();
  const result = store.submitQuiz("alice", answersWith(5, 5), false);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.result.style, "fearful");
});

test("submitQuiz computes the average score per dimension", () => {
  const store = new AttachmentStyleStore();
  const result = store.submitQuiz("alice", answersWith(4, 2), false);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.result.anxietyScore, 4);
    assert.equal(result.result.avoidanceScore, 2);
  }
});

test("get returns null before any quiz is submitted", () => {
  const store = new AttachmentStyleStore();
  assert.equal(store.get("alice"), null);
});

test("get returns the stored result after submission", () => {
  const store = new AttachmentStyleStore();
  store.submitQuiz("alice", answersWith(1, 1), true);
  const result = store.get("alice");
  assert.equal(result?.style, "secure");
  assert.equal(result?.hideResult, true);
});

test("results are tracked independently per author", () => {
  const store = new AttachmentStyleStore();
  store.submitQuiz("alice", answersWith(1, 1), false);
  assert.equal(store.get("bob"), null);
});

test("a later submission overwrites the previous result", () => {
  const store = new AttachmentStyleStore();
  store.submitQuiz("alice", answersWith(1, 1), false);
  store.submitQuiz("alice", answersWith(5, 5), false);
  assert.equal(store.get("alice")?.style, "fearful");
});

test("the question catalog has an equal split between dimensions", () => {
  const anxietyCount = ATTACHMENT_QUIZ_QUESTIONS.filter((q) => q.dimension === "anxiety").length;
  const avoidanceCount = ATTACHMENT_QUIZ_QUESTIONS.filter((q) => q.dimension === "avoidance").length;
  assert.equal(anxietyCount, avoidanceCount);
  assert.equal(anxietyCount + avoidanceCount, N);
});
