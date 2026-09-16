import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWidgetSummary } from "./widgetSummary";

test("passes through the given counts", () => {
  const summary = buildWidgetSummary({ unreadNotifications: 2, newLikes: 1, activeMatches: 5 });
  assert.equal(summary.unreadNotifications, 2);
  assert.equal(summary.newLikes, 1);
  assert.equal(summary.activeMatches, 5);
});

test("hasUpdates is false when there are no unread notifications or new likes", () => {
  const summary = buildWidgetSummary({ unreadNotifications: 0, newLikes: 0, activeMatches: 3 });
  assert.equal(summary.hasUpdates, false);
});

test("hasUpdates is true when there are unread notifications", () => {
  const summary = buildWidgetSummary({ unreadNotifications: 1, newLikes: 0, activeMatches: 0 });
  assert.equal(summary.hasUpdates, true);
});

test("hasUpdates is true when there are new likes", () => {
  const summary = buildWidgetSummary({ unreadNotifications: 0, newLikes: 1, activeMatches: 0 });
  assert.equal(summary.hasUpdates, true);
});

test("activeMatches alone doesn't set hasUpdates", () => {
  const summary = buildWidgetSummary({ unreadNotifications: 0, newLikes: 0, activeMatches: 10 });
  assert.equal(summary.hasUpdates, false);
});
