import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBio } from "./bioOptimizer";

test("an empty bio scores 0 and prompts the user to add something", () => {
  const result = analyzeBio("   ");
  assert.equal(result.score, 0);
  assert.equal(result.wordCount, 0);
  assert.ok(result.tips.some((t) => t.includes("empty")));
});

test("a too-short bio is penalized and flagged", () => {
  const result = analyzeBio("I like hiking.");
  assert.ok(result.wordCount < 15);
  assert.ok(result.tips.some((t) => t.includes("Add more detail")));
});

test("a very long bio is penalized and flagged", () => {
  const longBio = "I enjoy many things such as ".repeat(30);
  const result = analyzeBio(longBio);
  assert.ok(result.wordCount > 150);
  assert.ok(result.tips.some((t) => t.includes("Trim it down")));
});

test("hasQuestion is true only when the bio contains a question mark, and missing one is flagged", () => {
  const withQuestion = analyzeBio("I love hiking on weekends and exploring new trails around the city. What's your favorite trail?");
  assert.equal(withQuestion.hasQuestion, true);
  assert.ok(!withQuestion.tips.some((t) => t.includes("End with a question")));

  const withoutQuestion = analyzeBio("I love hiking on weekends and exploring new trails around the city every chance I get.");
  assert.equal(withoutQuestion.hasQuestion, false);
  assert.ok(withoutQuestion.tips.some((t) => t.includes("End with a question")));
});

test("cliché phrases are detected and flagged", () => {
  const result = analyzeBio("Just your average foodie who does love to travel and is living my best life every single day of the week.");
  assert.ok(result.clichesFound.includes("foodie"));
  assert.ok(result.clichesFound.includes("love to travel"));
  assert.ok(result.tips.some((t) => t.includes("generic phrases")));
});

test("a bio with few distinct meaningful keywords is flagged for specificity", () => {
  const result = analyzeBio("I am just a person who is here and there and does this and that sometimes.");
  assert.ok(result.keywordCount < 5);
  assert.ok(result.tips.some((t) => t.includes("specific interests")));
});

test("a well-rounded bio scores high with a single positive tip", () => {
  const result = analyzeBio(
    "I'm a software engineer who spends weekends rock climbing, cooking new recipes, and volunteering at the local animal shelter. What's the last trail or recipe you tried?"
  );
  assert.ok(result.score >= 80);
  assert.deepEqual(result.tips, ["This bio looks strong — specific, inviting, and easy to reply to."]);
});

test("score is always clamped between 0 and 100", () => {
  const badBio = "netflix and chill just ask swipe right down to earth living my best life";
  const result = analyzeBio(badBio);
  assert.ok(result.score >= 0 && result.score <= 100);
});
