import { test } from "node:test";
import assert from "node:assert/strict";
import { isSenderPhotoSuspicious } from "./photoWarning";

test("a sender with no reports is not suspicious", () => {
  assert.equal(isSenderPhotoSuspicious(0), false);
});

test("a sender below the report threshold is not suspicious", () => {
  assert.equal(isSenderPhotoSuspicious(2), false);
});

test("a sender at the report threshold is suspicious", () => {
  assert.equal(isSenderPhotoSuspicious(3), true);
});

test("a sender above the report threshold is suspicious", () => {
  assert.equal(isSenderPhotoSuspicious(10), true);
});
