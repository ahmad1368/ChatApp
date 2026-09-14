import test from "node:test";
import assert from "node:assert/strict";
import { CoupleQuizStore, QUIZ_QUESTIONS } from "./coupleQuiz";

function fullAnswers(pick: (question: (typeof QUIZ_QUESTIONS)[number]) => string) {
  const answers: Record<string, string> = {};
  for (const question of QUIZ_QUESTIONS) answers[question.id] = pick(question);
  return answers;
}

test("start() rejects a missing participant or self-quizzing", () => {
  const store = new CoupleQuizStore();
  assert.equal(store.start("", "bob").success, false);
  assert.equal(store.start("alice", "alice").success, false);
});

test("start() returns the same quizId when called again for the same pair, in either order", () => {
  const store = new CoupleQuizStore();
  const first = store.start("alice", "bob");
  const second = store.start("bob", "alice");
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  if (!first.success || !second.success) return;
  assert.equal(first.quizId, second.quizId);
});

test("submitAnswers() rejects a non-participant and an unknown quiz id", () => {
  const store = new CoupleQuizStore();
  const start = store.start("alice", "bob");
  if (!start.success) return;
  assert.equal(store.submitAnswers(start.quizId, "carol", fullAnswers((q) => q.options[0].id)).success, false);
  assert.equal(store.submitAnswers("not-a-real-id", "alice", fullAnswers((q) => q.options[0].id)).success, false);
});

test("submitAnswers() rejects incomplete or invalid answers", () => {
  const store = new CoupleQuizStore();
  const start = store.start("alice", "bob");
  if (!start.success) return;
  assert.equal(store.submitAnswers(start.quizId, "alice", {}).success, false);
  assert.equal(store.submitAnswers(start.quizId, "alice", fullAnswers(() => "not-a-real-option")).success, false);
});

test("submitAnswers() rejects a second submission from the same author", () => {
  const store = new CoupleQuizStore();
  const start = store.start("alice", "bob");
  if (!start.success) return;
  const answers = fullAnswers((q) => q.options[0].id);
  assert.equal(store.submitAnswers(start.quizId, "alice", answers).success, true);
  assert.equal(store.submitAnswers(start.quizId, "alice", answers).success, false);
});

test("getResult() hides the other participant's answers until both have submitted", () => {
  const store = new CoupleQuizStore();
  const start = store.start("alice", "bob");
  if (!start.success) return;
  store.submitAnswers(start.quizId, "alice", fullAnswers((q) => q.options[0].id));

  const result = store.getResult(start.quizId, "alice");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.result.bothSubmitted, false);
  assert.equal(result.result.theirAnswers, null);
  assert.equal(result.result.matchPercentage, null);
  assert.ok(result.result.myAnswers);
});

test("getResult() reveals both answers and a match percentage once both submit", () => {
  const store = new CoupleQuizStore();
  const start = store.start("alice", "bob");
  if (!start.success) return;
  store.submitAnswers(start.quizId, "alice", fullAnswers((q) => q.options[0].id));
  store.submitAnswers(start.quizId, "bob", fullAnswers((q) => q.options[0].id));

  const result = store.getResult(start.quizId, "bob");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.result.bothSubmitted, true);
  assert.deepEqual(result.result.theirAnswers, result.result.myAnswers);
  assert.equal(result.result.matchPercentage, 100);
});

test("getResult() computes a partial match percentage when answers differ", () => {
  const store = new CoupleQuizStore();
  const start = store.start("alice", "bob");
  if (!start.success) return;
  store.submitAnswers(start.quizId, "alice", fullAnswers((q) => q.options[0].id));
  store.submitAnswers(
    start.quizId,
    "bob",
    fullAnswers((q) => q.options[q.options.length - 1].id)
  );

  const result = store.getResult(start.quizId, "alice");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.ok(result.result.matchPercentage! >= 0 && result.result.matchPercentage! < 100);
});

test("getResult() rejects a non-participant", () => {
  const store = new CoupleQuizStore();
  const start = store.start("alice", "bob");
  if (!start.success) return;
  assert.equal(store.getResult(start.quizId, "carol").success, false);
});
