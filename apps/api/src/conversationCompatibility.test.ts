import test from "node:test";
import assert from "node:assert/strict";
import { analyzeConversationCompatibility } from "./conversationCompatibility";

test("reports not enough data when either side has too few messages", () => {
  const messages = [
    { author: "alice", text: "hi" },
    { author: "bob", text: "hey" },
  ];
  const result = analyzeConversationCompatibility(messages, "alice", "bob");
  assert.equal(result.hasEnoughData, false);
  assert.equal(result.compatibilityScore, 0);
});

test("balanceScore is 100 for a perfectly even conversation and lower for a lopsided one", () => {
  const even = [
    { author: "alice", text: "hi there" },
    { author: "bob", text: "hey" },
    { author: "alice", text: "how are you" },
    { author: "bob", text: "good, you" },
    { author: "alice", text: "great" },
    { author: "bob", text: "nice" },
  ];
  const evenResult = analyzeConversationCompatibility(even, "alice", "bob");
  assert.equal(evenResult.balanceScore, 100);

  const lopsided = [
    { author: "alice", text: "hi" },
    { author: "alice", text: "you there?" },
    { author: "alice", text: "hello?" },
    { author: "alice", text: "ok bye" },
    { author: "alice", text: "one more" },
    { author: "alice", text: "last one" },
    { author: "bob", text: "hey" },
    { author: "bob", text: "sorry busy" },
    { author: "bob", text: "yeah" },
  ];
  const lopsidedResult = analyzeConversationCompatibility(lopsided, "alice", "bob");
  assert.ok(lopsidedResult.balanceScore < 100);
});

test("curiosityScore rewards mutual question-asking, capped at 100", () => {
  const curious = [
    { author: "alice", text: "what do you do for fun?" },
    { author: "bob", text: "I love hiking, you?" },
    { author: "alice", text: "same! favorite trail?" },
    { author: "bob", text: "there's one near me, want to go sometime?" },
  ];
  const result = analyzeConversationCompatibility(curious, "alice", "bob");
  assert.equal(result.curiosityScore, 100);
  assert.ok(result.curiosityScore <= 100);
});

test("topicOverlapScore and sharedKeywords reflect real shared vocabulary in the conversation", () => {
  const messages = [
    { author: "alice", text: "I love hiking and camping on weekends" },
    { author: "bob", text: "hiking is great, I go camping too" },
    { author: "alice", text: "what trails have you done" },
    { author: "bob", text: "mostly camping near the mountains" },
  ];
  const result = analyzeConversationCompatibility(messages, "alice", "bob");
  assert.ok(result.sharedKeywords.includes("hiking"));
  assert.ok(result.sharedKeywords.includes("camping"));
  assert.ok(result.topicOverlapScore > 0);
});

test("avgMessageLength reflects real word counts per author and isn't part of the score", () => {
  const messages = [
    { author: "alice", text: "this is a much longer message with many more words in it" },
    { author: "alice", text: "another longer message here too" },
    { author: "alice", text: "and one more for good measure" },
    { author: "bob", text: "ok" },
    { author: "bob", text: "sure" },
    { author: "bob", text: "yep" },
  ];
  const result = analyzeConversationCompatibility(messages, "alice", "bob");
  assert.ok(result.avgMessageLengthA > result.avgMessageLengthB);
});

test("compatibilityScore is the equal-weighted average of the three sub-scores when there's enough data", () => {
  const messages = [
    { author: "alice", text: "hi there, how are you?" },
    { author: "bob", text: "good, you?" },
    { author: "alice", text: "great, what are you up to?" },
    { author: "bob", text: "just relaxing today" },
    { author: "alice", text: "nice, any plans this weekend?" },
    { author: "bob", text: "maybe some hiking, you?" },
  ];
  const result = analyzeConversationCompatibility(messages, "alice", "bob");
  assert.equal(result.hasEnoughData, true);
  const expected = Math.round((result.balanceScore + result.curiosityScore + result.topicOverlapScore) / 3);
  assert.equal(result.compatibilityScore, expected);
});
