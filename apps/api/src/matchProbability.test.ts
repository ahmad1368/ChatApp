import test from "node:test";
import assert from "node:assert/strict";
import { computeMatchProbability } from "./matchProbability";

test("reports not enough data with fewer than 2 signals", () => {
  const result = computeMatchProbability([{ label: "interests", score: 80, weight: 1 }]);
  assert.equal(result.hasEnoughData, false);
  assert.equal(result.probability, 0);
});

test("computes a weighted average across available signals", () => {
  const result = computeMatchProbability([
    { label: "interests", score: 100, weight: 1 },
    { label: "music", score: 0, weight: 1 },
  ]);
  assert.equal(result.hasEnoughData, true);
  assert.equal(result.probability, 50);
});

test("weights a higher-weight signal more heavily", () => {
  const result = computeMatchProbability([
    { label: "interests", score: 0, weight: 1 },
    { label: "conversation", score: 100, weight: 2 },
  ]);
  // (0*1 + 100*2) / 3 = 66.67, rounds to 67
  assert.equal(result.probability, 67);
});

test("confidence reflects how many real signals were available", () => {
  const two = computeMatchProbability([
    { label: "a", score: 50, weight: 1 },
    { label: "b", score: 50, weight: 1 },
  ]);
  assert.equal(two.confidence, "low");

  const three = computeMatchProbability([
    { label: "a", score: 50, weight: 1 },
    { label: "b", score: 50, weight: 1 },
    { label: "c", score: 50, weight: 1 },
  ]);
  assert.equal(three.confidence, "medium");

  const four = computeMatchProbability([
    { label: "a", score: 50, weight: 1 },
    { label: "b", score: 50, weight: 1 },
    { label: "c", score: 50, weight: 1 },
    { label: "d", score: 50, weight: 1 },
  ]);
  assert.equal(four.confidence, "high");
});

test("echoes back the signals it was given", () => {
  const inputSignals = [
    { label: "interests", score: 60, weight: 1 },
    { label: "music", score: 40, weight: 1 },
  ];
  const result = computeMatchProbability(inputSignals);
  assert.deepEqual(result.signals, inputSignals);
});
