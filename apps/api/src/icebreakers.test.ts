import { test } from "node:test";
import assert from "node:assert/strict";
import { generateIcebreakers } from "./icebreakers";

const EMPTY_SIGNALS = { interests: [], musicTracks: [], weekendPlans: [], bioKeywords: [] };

test("generateIcebreakers() falls back to generic prompts with no shared signals", () => {
  const result = generateIcebreakers(EMPTY_SIGNALS);
  assert.equal(result.length, 5);
  result.forEach((line) => assert.equal(typeof line, "string"));
});

test("generateIcebreakers() mentions a shared interest", () => {
  const result = generateIcebreakers({ ...EMPTY_SIGNALS, interests: ["hiking"] });
  assert.ok(result.some((line) => line.includes("hiking")));
});

test("generateIcebreakers() mentions a shared music track", () => {
  const result = generateIcebreakers({ ...EMPTY_SIGNALS, musicTracks: ["Song A"] });
  assert.ok(result.some((line) => line.includes("Song A")));
});

test("generateIcebreakers() mentions a shared weekend plan", () => {
  const result = generateIcebreakers({ ...EMPTY_SIGNALS, weekendPlans: ["brunch"] });
  assert.ok(result.some((line) => line.includes("brunch")));
});

test("generateIcebreakers() mentions a shared bio keyword", () => {
  const result = generateIcebreakers({ ...EMPTY_SIGNALS, bioKeywords: ["climbing"] });
  assert.ok(result.some((line) => line.includes("climbing")));
});

test("generateIcebreakers() prioritizes personalized suggestions over generic ones", () => {
  const result = generateIcebreakers(
    { interests: ["hiking"], musicTracks: ["Song A"], weekendPlans: [], bioKeywords: [] },
    2
  );
  assert.equal(result.length, 2);
  assert.ok(result[0].includes("hiking"));
  assert.ok(result[1].includes("Song A"));
});

test("generateIcebreakers() respects a custom limit", () => {
  const result = generateIcebreakers(EMPTY_SIGNALS, 3);
  assert.equal(result.length, 3);
});

test("generateIcebreakers() caps total suggestions at the limit even with many shared signals", () => {
  const result = generateIcebreakers(
    { interests: ["hiking", "yoga", "gaming"], musicTracks: ["Song A"], weekendPlans: ["brunch"], bioKeywords: ["climbing"] },
    3
  );
  assert.equal(result.length, 3);
});
