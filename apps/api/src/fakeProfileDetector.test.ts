import { test } from "node:test";
import assert from "node:assert/strict";
import { scanCandidateForFakeProfile, REPORT_THRESHOLD } from "./fakeProfileDetector";

test("scanCandidateForFakeProfile() does not flag a clean profile", () => {
  const result = scanCandidateForFakeProfile({ bio: "I love hiking and coffee", reportCount: 0, hasDuplicatePhoto: false });
  assert.deepEqual(result, { flagged: false, reasons: [] });
});

test("scanCandidateForFakeProfile() flags a profile at the report threshold", () => {
  const result = scanCandidateForFakeProfile({ bio: "", reportCount: REPORT_THRESHOLD, hasDuplicatePhoto: false });
  assert.equal(result.flagged, true);
  assert.deepEqual(result.reasons, ["reported"]);
});

test("scanCandidateForFakeProfile() does not flag a profile just below the report threshold", () => {
  const result = scanCandidateForFakeProfile({ bio: "", reportCount: REPORT_THRESHOLD - 1, hasDuplicatePhoto: false });
  assert.equal(result.flagged, false);
});

test("scanCandidateForFakeProfile() flags a spam bio", () => {
  const result = scanCandidateForFakeProfile({ bio: "check out my onlyfans", reportCount: 0, hasDuplicatePhoto: false });
  assert.equal(result.flagged, true);
  assert.deepEqual(result.reasons, ["spam_bio"]);
});

test("scanCandidateForFakeProfile() flags a bio containing a URL", () => {
  const result = scanCandidateForFakeProfile({ bio: "hit me up at https://example.com", reportCount: 0, hasDuplicatePhoto: false });
  assert.equal(result.flagged, true);
  assert.deepEqual(result.reasons, ["spam_bio"]);
});

test("scanCandidateForFakeProfile() reports both reasons when both signals fire", () => {
  const result = scanCandidateForFakeProfile({ bio: "earn money from home", reportCount: REPORT_THRESHOLD, hasDuplicatePhoto: false });
  assert.equal(result.flagged, true);
  assert.deepEqual(result.reasons, ["reported", "spam_bio"]);
});

test("scanCandidateForFakeProfile() flags a duplicate photo (#267)", () => {
  const result = scanCandidateForFakeProfile({ bio: "", reportCount: 0, hasDuplicatePhoto: true });
  assert.equal(result.flagged, true);
  assert.deepEqual(result.reasons, ["duplicate_photo"]);
});

test("scanCandidateForFakeProfile() reports all three reasons when every signal fires", () => {
  const result = scanCandidateForFakeProfile({ bio: "earn money from home", reportCount: REPORT_THRESHOLD, hasDuplicatePhoto: true });
  assert.equal(result.flagged, true);
  assert.deepEqual(result.reasons, ["reported", "spam_bio", "duplicate_photo"]);
});
