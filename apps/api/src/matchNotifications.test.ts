import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNewMatchNotification } from "./matchNotifications";

test("buildNewMatchNotification() includes the matched author's name in the body", () => {
  const result = buildNewMatchNotification("bob");
  assert.match(result.body, /bob/);
});

test("buildNewMatchNotification() returns a non-empty title", () => {
  const result = buildNewMatchNotification("bob");
  assert.ok(result.title.length > 0);
});

test("buildNewMatchNotification() produces a different body for a different author", () => {
  const forBob = buildNewMatchNotification("bob");
  const forCarol = buildNewMatchNotification("carol");
  assert.notEqual(forBob.body, forCarol.body);
});
