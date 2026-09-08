import { test } from "node:test";
import assert from "node:assert/strict";
import { checkVideoCallEligibility, MIN_MESSAGES_BEFORE_VIDEO_CALL } from "./videoCallGate";

test("checkVideoCallEligibility() is not eligible with no messages", () => {
  const result = checkVideoCallEligibility([], "alice", "bob");
  assert.deepEqual(result, { eligible: false, messagesExchanged: 0, required: MIN_MESSAGES_BEFORE_VIDEO_CALL });
});

test("checkVideoCallEligibility() counts messages from either participant", () => {
  const messages = [
    { author: "alice" },
    { author: "bob" },
    { author: "alice" },
  ];
  const result = checkVideoCallEligibility(messages, "alice", "bob");
  assert.equal(result.messagesExchanged, 3);
  assert.equal(result.eligible, false);
});

test("checkVideoCallEligibility() ignores messages from other authors in the room", () => {
  const messages = [{ author: "alice" }, { author: "carol" }, { author: "bob" }];
  const result = checkVideoCallEligibility(messages, "alice", "bob");
  assert.equal(result.messagesExchanged, 2);
});

test("checkVideoCallEligibility() is eligible right at the threshold", () => {
  const messages = Array.from({ length: MIN_MESSAGES_BEFORE_VIDEO_CALL }, (_, i) => ({
    author: i % 2 === 0 ? "alice" : "bob",
  }));
  const result = checkVideoCallEligibility(messages, "alice", "bob");
  assert.equal(result.messagesExchanged, MIN_MESSAGES_BEFORE_VIDEO_CALL);
  assert.equal(result.eligible, true);
});

test("checkVideoCallEligibility() is not eligible one message below the threshold", () => {
  const messages = Array.from({ length: MIN_MESSAGES_BEFORE_VIDEO_CALL - 1 }, (_, i) => ({
    author: i % 2 === 0 ? "alice" : "bob",
  }));
  const result = checkVideoCallEligibility(messages, "alice", "bob");
  assert.equal(result.eligible, false);
});

test("checkVideoCallEligibility() counts all messages even if entirely one-sided", () => {
  const messages = Array.from({ length: MIN_MESSAGES_BEFORE_VIDEO_CALL }, () => ({ author: "alice" }));
  const result = checkVideoCallEligibility(messages, "alice", "bob");
  assert.equal(result.eligible, true);
});
