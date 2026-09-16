import { test } from "node:test";
import assert from "node:assert/strict";
import { getSimilarProfiles } from "./similarProfiles";

test("getSimilarProfiles() ranks candidates by interest similarity to the selected profile, highest first", () => {
  const pool = [
    { author: "bob", interests: ["hiking", "coffee"] },
    { author: "carol", interests: ["hiking", "coffee", "travel"] },
    { author: "dave", interests: ["gaming"] },
  ];
  const result = getSimilarProfiles(["hiking", "coffee", "travel"], pool, "alice");
  assert.deepEqual(
    result.map((r) => r.author),
    ["carol", "bob", "dave"]
  );
});

test("getSimilarProfiles() excludes the given author from the results", () => {
  const pool = [
    { author: "alice", interests: ["hiking"] },
    { author: "bob", interests: ["hiking"] },
  ];
  const result = getSimilarProfiles(["hiking"], pool, "alice");
  assert.deepEqual(
    result.map((r) => r.author),
    ["bob"]
  );
});

test("getSimilarProfiles() respects the limit", () => {
  const pool = [
    { author: "bob", interests: ["hiking"] },
    { author: "carol", interests: ["hiking"] },
    { author: "dave", interests: ["hiking"] },
  ];
  const result = getSimilarProfiles(["hiking"], pool, "alice", 2);
  assert.equal(result.length, 2);
});

test("getSimilarProfiles() gives 0 similarity when either side has no interests", () => {
  const pool = [{ author: "bob", interests: [] }];
  const result = getSimilarProfiles([], pool, "alice");
  assert.deepEqual(result, [{ author: "bob", similarity: 0 }]);
});
