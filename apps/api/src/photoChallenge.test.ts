import { test } from "node:test";
import assert from "node:assert/strict";
import { PhotoChallengeStore, PHOTO_CHALLENGE_THEMES } from "./photoChallenge";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

test("getCurrentTheme() returns a real theme from the fixed catalog", () => {
  const store = new PhotoChallengeStore();
  const { theme } = store.getCurrentTheme(Date.now());
  assert.ok((PHOTO_CHALLENGE_THEMES as readonly string[]).includes(theme));
});

test("getCurrentTheme() rotates deterministically week to week", () => {
  const store = new PhotoChallengeStore();
  const weekOne = store.getCurrentTheme(0);
  const weekTwo = store.getCurrentTheme(WEEK_MS);
  assert.notEqual(weekOne.theme, weekTwo.theme);
});

test("getCurrentTheme() cycles back after going through every theme", () => {
  const store = new PhotoChallengeStore();
  const first = store.getCurrentTheme(0);
  const cycled = store.getCurrentTheme(WEEK_MS * PHOTO_CHALLENGE_THEMES.length);
  assert.equal(first.theme, cycled.theme);
});

test("submit() accepts a valid submission", () => {
  const store = new PhotoChallengeStore();
  const result = store.submit("alice", "photo-1");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.submission.author, "alice");
    assert.equal(result.submission.photoId, "photo-1");
    assert.equal(result.submission.votes, 0);
  }
});

test("submit() rejects a missing author or photoId", () => {
  const store = new PhotoChallengeStore();
  assert.equal(store.submit("", "photo-1").success, false);
  assert.equal(store.submit("alice", "").success, false);
});

test("submit() rejects a second submission from the same author in the same week", () => {
  const store = new PhotoChallengeStore();
  store.submit("alice", "photo-1", 0);
  const result = store.submit("alice", "photo-2", 0);
  assert.equal(result.success, false);
});

test("submit() allows a new submission from the same author in a later week", () => {
  const store = new PhotoChallengeStore();
  store.submit("alice", "photo-1", 0);
  const result = store.submit("alice", "photo-2", WEEK_MS);
  assert.equal(result.success, true);
});

test("getSubmissions() only returns the current week's submissions, highest-voted first", () => {
  const store = new PhotoChallengeStore();
  store.submit("alice", "photo-1", 0);
  store.submit("bob", "photo-2", 0);
  store.submit("carol", "photo-3", WEEK_MS); // different week

  store.vote("dave", store.getSubmissions(0)[1].id, 0); // vote for bob's

  const submissions = store.getSubmissions(0);
  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].author, "bob");
});

test("vote() increments the vote count", () => {
  const store = new PhotoChallengeStore();
  const submitted = store.submit("alice", "photo-1", 0);
  assert.ok(submitted.success);
  const result = store.vote("bob", submitted.success ? submitted.submission.id : "", 0);
  assert.deepEqual(result, { success: true, votes: 1 });
});

test("vote() rejects voting for your own submission", () => {
  const store = new PhotoChallengeStore();
  const submitted = store.submit("alice", "photo-1", 0);
  assert.ok(submitted.success);
  const result = store.vote("alice", submitted.success ? submitted.submission.id : "", 0);
  assert.equal(result.success, false);
});

test("vote() rejects a second vote from the same voter on the same submission", () => {
  const store = new PhotoChallengeStore();
  const submitted = store.submit("alice", "photo-1", 0);
  assert.ok(submitted.success);
  const id = submitted.success ? submitted.submission.id : "";
  store.vote("bob", id, 0);
  const result = store.vote("bob", id, 0);
  assert.equal(result.success, false);
});

test("vote() rejects a missing voter or unknown submission", () => {
  const store = new PhotoChallengeStore();
  assert.equal(store.vote("", "1", 0).success, false);
  assert.equal(store.vote("bob", "does-not-exist", 0).success, false);
});
