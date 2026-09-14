import test from "node:test";
import assert from "node:assert/strict";
import { KarmaScoreStore, KARMA_STARTING_SCORE, KARMA_REPORT_PENALTY, KARMA_BLOCK_PENALTY, KARMA_MATCH_REWARD, KARMA_MAX_SCORE } from "./karmaScore";

test("getScore() starts everyone at the neutral starting score", () => {
  const store = new KarmaScoreStore();
  assert.equal(store.getScore("alice"), KARMA_STARTING_SCORE);
});

test("recordReportReceived() docks points from the reported author", () => {
  const store = new KarmaScoreStore();
  store.recordReportReceived("alice", "report-1");
  assert.equal(store.getScore("alice"), KARMA_STARTING_SCORE - KARMA_REPORT_PENALTY);
});

test("recordReportReceived() only applies once per report id", () => {
  const store = new KarmaScoreStore();
  store.recordReportReceived("alice", "report-1");
  store.recordReportReceived("alice", "report-1");
  assert.equal(store.getScore("alice"), KARMA_STARTING_SCORE - KARMA_REPORT_PENALTY);
});

test("recordReportReceived() ignores a missing author or report id", () => {
  const store = new KarmaScoreStore();
  store.recordReportReceived("", "report-1");
  store.recordReportReceived("alice", "");
  assert.equal(store.getScore("alice"), KARMA_STARTING_SCORE);
});

test("recordBlockReceived() docks points once per distinct blocker", () => {
  const store = new KarmaScoreStore();
  store.recordBlockReceived("alice", "bob");
  store.recordBlockReceived("alice", "bob");
  assert.equal(store.getScore("alice"), KARMA_STARTING_SCORE - KARMA_BLOCK_PENALTY);
  store.recordBlockReceived("alice", "carol");
  assert.equal(store.getScore("alice"), KARMA_STARTING_SCORE - KARMA_BLOCK_PENALTY * 2);
});

test("recordMatch() rewards both sides once per pair", () => {
  const store = new KarmaScoreStore();
  store.recordMatch("alice", "bob");
  assert.equal(store.getScore("alice"), KARMA_STARTING_SCORE + KARMA_MATCH_REWARD);
  assert.equal(store.getScore("bob"), KARMA_STARTING_SCORE + KARMA_MATCH_REWARD);

  store.recordMatch("bob", "alice");
  assert.equal(store.getScore("alice"), KARMA_STARTING_SCORE + KARMA_MATCH_REWARD);
});

test("score is clamped at the maximum even after many rewards", () => {
  const store = new KarmaScoreStore();
  for (let i = 0; i < 50; i++) {
    store.recordMatch("alice", `friend${i}`);
  }
  assert.equal(store.getScore("alice"), KARMA_MAX_SCORE);
});

test("score is clamped at the minimum even after many penalties", () => {
  const store = new KarmaScoreStore();
  for (let i = 0; i < 50; i++) {
    store.recordReportReceived("alice", `report-${i}`);
  }
  assert.equal(store.getScore("alice"), 0);
});

test("each author's score is independent", () => {
  const store = new KarmaScoreStore();
  store.recordReportReceived("alice", "report-1");
  assert.equal(store.getScore("bob"), KARMA_STARTING_SCORE);
});
