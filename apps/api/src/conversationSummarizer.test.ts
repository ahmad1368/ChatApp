import test from "node:test";
import assert from "node:assert/strict";
import { summarizeConversation } from "./conversationSummarizer";

function msg(author: string, text: string, createdAt: string) {
  return { author, text, createdAt };
}

test("reports not enough data for a short conversation", () => {
  const messages = [msg("alice", "hi", "2026-01-01T00:00:00.000Z"), msg("bob", "hey", "2026-01-01T00:01:00.000Z")];
  const result = summarizeConversation(messages);
  assert.equal(result.hasEnoughData, false);
  assert.equal(result.dateRange, null);
  assert.deepEqual(result.topKeywords, []);
  assert.deepEqual(result.highlights, []);
});

function longConversation() {
  return [
    msg("alice", "hi there, how's your week going?", "2026-01-01T00:00:00.000Z"),
    msg("bob", "pretty good, just got back from hiking", "2026-01-01T00:01:00.000Z"),
    msg("alice", "nice, I love hiking too, where did you go?", "2026-01-01T00:02:00.000Z"),
    msg("bob", "a trail near the mountains, really beautiful views", "2026-01-01T00:03:00.000Z"),
    msg("alice", "sounds amazing", "2026-01-01T00:04:00.000Z"),
    msg("bob", "yeah", "2026-01-01T00:05:00.000Z"),
    msg("alice", "do you go hiking every weekend?", "2026-01-01T00:06:00.000Z"),
    msg("bob", "most weekends when the weather is good", "2026-01-01T00:07:00.000Z"),
    msg("alice", "that's awesome, I'd love to try that trail sometime", "2026-01-01T00:08:00.000Z"),
    msg("bob", "we should go together sometime", "2026-01-01T00:09:00.000Z"),
    msg("alice", "definitely, I'm in", "2026-01-01T00:10:00.000Z"),
  ];
}

test("returns dateRange spanning the first and last message once there's enough data", () => {
  const result = summarizeConversation(longConversation());
  assert.equal(result.hasEnoughData, true);
  assert.equal(result.dateRange?.first, "2026-01-01T00:00:00.000Z");
  assert.equal(result.dateRange?.last, "2026-01-01T00:10:00.000Z");
});

test("topKeywords surfaces the most frequently discussed real words", () => {
  const result = summarizeConversation(longConversation());
  assert.ok(result.topKeywords.includes("hiking"));
});

test("highlights favors longer messages and questions, capped and returned in chronological order", () => {
  const result = summarizeConversation(longConversation());
  assert.ok(result.highlights.length > 0);
  assert.ok(result.highlights.length <= 5);
  for (let i = 1; i < result.highlights.length; i++) {
    assert.ok(new Date(result.highlights[i].createdAt).getTime() >= new Date(result.highlights[i - 1].createdAt).getTime());
  }
  // The short "yeah" reply should not be picked as a highlight over the longer, question-bearing messages.
  assert.ok(!result.highlights.some((h) => h.text === "yeah"));
});
