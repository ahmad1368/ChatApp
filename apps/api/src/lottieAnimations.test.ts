import { test } from "node:test";
import assert from "node:assert/strict";
import { getLottieAnimationCatalog, findLottieAnimation, LOTTIE_ANIMATION_CATALOG } from "./lottieAnimations";

test("getLottieAnimationCatalog() returns the full catalog", () => {
  assert.deepEqual(getLottieAnimationCatalog(), LOTTIE_ANIMATION_CATALOG);
});

test("getLottieAnimationCatalog() includes the match-celebration animation", () => {
  const catalog = getLottieAnimationCatalog();
  assert.ok(catalog.some((entry) => entry.id === "match-celebration"));
});

test("findLottieAnimation() finds an entry by id", () => {
  const entry = findLottieAnimation("match-celebration");
  assert.equal(entry?.path, "/lottie/match-celebration.json");
});

test("findLottieAnimation() returns undefined for an unknown id", () => {
  assert.equal(findLottieAnimation("does-not-exist"), undefined);
});
