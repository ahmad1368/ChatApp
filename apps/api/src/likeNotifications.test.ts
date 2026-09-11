import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNewLikeNotification } from "./likeNotifications";

test("buildNewLikeNotification() returns non-empty content for an ordinary like", () => {
  const result = buildNewLikeNotification(false);
  assert.ok(result.title.length > 0);
  assert.ok(result.body.length > 0);
});

test("buildNewLikeNotification() never names anyone for a super like", () => {
  const result = buildNewLikeNotification(true);
  assert.ok(result.title.length > 0);
  assert.ok(result.body.length > 0);
});

test("buildNewLikeNotification() distinguishes a super like from an ordinary like", () => {
  const like = buildNewLikeNotification(false);
  const superLike = buildNewLikeNotification(true);
  assert.notEqual(like.title, superLike.title);
});
