import { test } from "node:test";
import assert from "node:assert/strict";
import { DuplicatePhotoDetector } from "./duplicatePhotoDetection";

test("a first upload is never a duplicate", () => {
  const detector = new DuplicatePhotoDetector();
  const result = detector.recordAndCheck("alice", Buffer.from("photo bytes"));
  assert.equal(result.isDuplicate, false);
  assert.deepEqual(result.usedByOtherAuthors, []);
});

test("the same author re-uploading the same bytes is not flagged as a duplicate", () => {
  const detector = new DuplicatePhotoDetector();
  detector.recordAndCheck("alice", Buffer.from("photo bytes"));
  const result = detector.recordAndCheck("alice", Buffer.from("photo bytes"));
  assert.equal(result.isDuplicate, false);
});

test("a different author uploading the identical bytes is flagged as a duplicate", () => {
  const detector = new DuplicatePhotoDetector();
  detector.recordAndCheck("alice", Buffer.from("stolen photo"));
  const result = detector.recordAndCheck("bob", Buffer.from("stolen photo"));
  assert.equal(result.isDuplicate, true);
  assert.deepEqual(result.usedByOtherAuthors, ["alice"]);
});

test("different photo bytes are never considered duplicates", () => {
  const detector = new DuplicatePhotoDetector();
  detector.recordAndCheck("alice", Buffer.from("photo A"));
  const result = detector.recordAndCheck("bob", Buffer.from("photo B"));
  assert.equal(result.isDuplicate, false);
});

test("isFlagged() is false before any duplicate is detected", () => {
  const detector = new DuplicatePhotoDetector();
  detector.recordAndCheck("alice", Buffer.from("photo bytes"));
  assert.equal(detector.isFlagged("alice"), false);
});

test("isFlagged() becomes true for both the original and copying author", () => {
  const detector = new DuplicatePhotoDetector();
  detector.recordAndCheck("alice", Buffer.from("stolen photo"));
  detector.recordAndCheck("bob", Buffer.from("stolen photo"));
  assert.equal(detector.isFlagged("alice"), true);
  assert.equal(detector.isFlagged("bob"), true);
});

test("isFlagged() stays false for an unrelated author", () => {
  const detector = new DuplicatePhotoDetector();
  detector.recordAndCheck("alice", Buffer.from("stolen photo"));
  detector.recordAndCheck("bob", Buffer.from("stolen photo"));
  assert.equal(detector.isFlagged("carol"), false);
});

test("a third author uploading the same bytes is flagged against both prior authors", () => {
  const detector = new DuplicatePhotoDetector();
  detector.recordAndCheck("alice", Buffer.from("stolen photo"));
  detector.recordAndCheck("bob", Buffer.from("stolen photo"));
  const result = detector.recordAndCheck("carol", Buffer.from("stolen photo"));
  assert.deepEqual(result.usedByOtherAuthors.sort(), ["alice", "bob"]);
});
