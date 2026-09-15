import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTypingPattern } from "./typingPatternDetector";

function msg(roomId: string, text: string, createdAt: string) {
  return { roomId, text, createdAt };
}

test("reports not enough data for very few messages", () => {
  const result = analyzeTypingPattern([msg("r1", "hi", "2026-01-01T00:00:00.000Z"), msg("r1", "there", "2026-01-01T00:00:02.000Z")]);
  assert.equal(result.hasEnoughData, false);
  assert.equal(result.flagged, false);
});

test("a normal human-like conversation is not flagged", () => {
  const messages = [
    msg("r1", "hey there, how's it going?", "2026-01-01T00:00:00.000Z"),
    msg("r1", "pretty good, you?", "2026-01-01T00:04:12.000Z"),
    msg("r1", "same here, just relaxing", "2026-01-01T00:11:45.000Z"),
    msg("r1", "nice, any plans this weekend?", "2026-01-01T00:22:30.000Z"),
    msg("r1", "thinking about hiking maybe", "2026-01-01T00:25:03.000Z"),
    msg("r1", "sounds fun!", "2026-01-01T01:10:00.000Z"),
  ];
  const result = analyzeTypingPattern(messages);
  assert.equal(result.hasEnoughData, true);
  assert.equal(result.flagged, false);
});

test("flags impossibly fast, sub-1.5s replies", () => {
  const base = new Date("2026-01-01T00:00:00.000Z").getTime();
  const messages = Array.from({ length: 6 }, (_, i) => msg("r1", `reply number ${i} here`, new Date(base + i * 800).toISOString()));
  const result = analyzeTypingPattern(messages);
  assert.ok(result.reasons.includes("impossibly_fast_replies"));
  assert.equal(result.flagged, true);
});

test("flags suspiciously uniform timing even when each interval is individually plausible", () => {
  const base = new Date("2026-01-01T00:00:00.000Z").getTime();
  const messages = Array.from({ length: 6 }, (_, i) => msg("r1", `message number ${i} content`, new Date(base + i * 5000).toISOString()));
  const result = analyzeTypingPattern(messages);
  assert.ok(result.reasons.includes("uniform_timing"));
});

test("flags the same non-trivial text broadcast to several different rooms", () => {
  const messages = [
    msg("r1", "hey I think you're really cute, want to chat?", "2026-01-01T00:00:00.000Z"),
    msg("r2", "hey I think you're really cute, want to chat?", "2026-01-01T00:30:00.000Z"),
    msg("r3", "hey I think you're really cute, want to chat?", "2026-01-01T01:00:00.000Z"),
    msg("r1", "totally different message here", "2026-01-01T01:30:00.000Z"),
    msg("r2", "another unique reply for this one", "2026-01-01T02:00:00.000Z"),
  ];
  const result = analyzeTypingPattern(messages);
  assert.ok(result.reasons.includes("duplicate_broadcast_text"));
});

test("does not flag short, generic repeated replies like 'ok' or 'lol'", () => {
  const messages = [
    msg("r1", "ok", "2026-01-01T00:00:00.000Z"),
    msg("r2", "ok", "2026-01-01T00:30:00.000Z"),
    msg("r3", "ok", "2026-01-01T01:00:00.000Z"),
    msg("r1", "a real longer message that varies each time", "2026-01-01T01:30:00.000Z"),
    msg("r2", "another distinct longer message content here", "2026-01-01T02:15:00.000Z"),
  ];
  const result = analyzeTypingPattern(messages);
  assert.ok(!result.reasons.includes("duplicate_broadcast_text"));
});
