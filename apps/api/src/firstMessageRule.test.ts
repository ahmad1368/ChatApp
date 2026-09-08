import { test } from "node:test";
import assert from "node:assert/strict";
import { canSendFirstMessage } from "./firstMessageRule";

test("canSendFirstMessage() allows a woman to message a man first", () => {
  assert.deepEqual(canSendFirstMessage("woman", "man"), { allowed: true });
});

test("canSendFirstMessage() blocks a man from messaging a woman first", () => {
  const result = canSendFirstMessage("man", "woman");
  assert.deepEqual(result, { allowed: false, error: "In a match with a woman, only she can send the first message" });
});

test("canSendFirstMessage() allows either side in a woman-woman match", () => {
  assert.deepEqual(canSendFirstMessage("woman", "woman"), { allowed: true });
});

test("canSendFirstMessage() allows either side in a man-man match", () => {
  assert.deepEqual(canSendFirstMessage("man", "man"), { allowed: true });
});

test("canSendFirstMessage() allows either side when either gender is non-binary", () => {
  assert.deepEqual(canSendFirstMessage("man", "nonBinary"), { allowed: true });
  assert.deepEqual(canSendFirstMessage("nonBinary", "man"), { allowed: true });
});

test("canSendFirstMessage() allows either side when a gender is unknown (not yet declared)", () => {
  assert.deepEqual(canSendFirstMessage(undefined, "man"), { allowed: true });
  assert.deepEqual(canSendFirstMessage("man", undefined), { allowed: true });
  assert.deepEqual(canSendFirstMessage(undefined, undefined), { allowed: true });
});

test("canSendFirstMessage() allows either side when a gender is 'preferNotToSay'", () => {
  assert.deepEqual(canSendFirstMessage("man", "preferNotToSay"), { allowed: true });
});
