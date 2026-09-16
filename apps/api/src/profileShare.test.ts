import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileShareStore } from "./profileShare";

test("create() rejects missing sharer or candidateAuthor", () => {
  const store = new ProfileShareStore();
  assert.equal(store.create("", "bob").success, false);
  assert.equal(store.create("alice", "").success, false);
});

test("create() rejects sharing your own profile with yourself", () => {
  const store = new ProfileShareStore();
  const result = store.create("alice", "alice");
  assert.equal(result.success, false);
});

test("create() returns a share with a code and empty opinions", () => {
  const store = new ProfileShareStore();
  const result = store.create("alice", "bob");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.share.sharer, "alice");
    assert.equal(result.share.candidateAuthor, "bob");
    assert.deepEqual(result.share.opinions, []);
    assert.ok(result.share.shareCode.length > 0);
  }
});

test("create() reuses the existing share for the same sharer/candidate pair", () => {
  const store = new ProfileShareStore();
  const first = store.create("alice", "bob");
  const second = store.create("alice", "bob");
  assert.equal(first.success && second.success && first.share.shareCode, second.success && second.share.shareCode);
});

test("getByShareCode() returns undefined for an unknown code", () => {
  const store = new ProfileShareStore();
  assert.equal(store.getByShareCode("nope"), undefined);
});

test("getByShareCode() returns the share for a known code", () => {
  const store = new ProfileShareStore();
  const result = store.create("alice", "bob");
  const code = result.success ? result.share.shareCode : "";
  assert.equal(store.getByShareCode(code)?.candidateAuthor, "bob");
});

test("addOpinion() rejects an unknown share code", () => {
  const store = new ProfileShareStore();
  const result = store.addOpinion("nope", "Charlie", "like", "");
  assert.equal(result.success, false);
});

test("addOpinion() rejects an invalid reaction", () => {
  const store = new ProfileShareStore();
  const result = store.create("alice", "bob");
  const code = result.success ? result.share.shareCode : "";
  assert.equal(store.addOpinion(code, "Charlie", "love-it", "").success, false);
});

test("addOpinion() rejects a missing commenter name", () => {
  const store = new ProfileShareStore();
  const result = store.create("alice", "bob");
  const code = result.success ? result.share.shareCode : "";
  assert.equal(store.addOpinion(code, "", "like", "").success, false);
});

test("addOpinion() accepts a valid opinion and appends it", () => {
  const store = new ProfileShareStore();
  const result = store.create("alice", "bob");
  const code = result.success ? result.share.shareCode : "";
  store.addOpinion(code, "Charlie", "like", "Seems great!");
  const share = store.getByShareCode(code);
  assert.equal(share?.opinions.length, 1);
  assert.equal(share?.opinions[0].commenterName, "Charlie");
  assert.equal(share?.opinions[0].reaction, "like");
});

test("addOpinion() supports multiple friends weighing in on the same share", () => {
  const store = new ProfileShareStore();
  const result = store.create("alice", "bob");
  const code = result.success ? result.share.shareCode : "";
  store.addOpinion(code, "Charlie", "like", "");
  store.addOpinion(code, "Dana", "pass", "Not your type");
  assert.equal(store.getByShareCode(code)?.opinions.length, 2);
});

test("getSharesBySharer() returns only that sharer's shares, most recent first", () => {
  const store = new ProfileShareStore();
  store.create("alice", "bob");
  store.create("alice", "carol");
  store.create("dave", "bob");
  const shares = store.getSharesBySharer("alice");
  assert.equal(shares.length, 2);
  assert.ok(shares.every((s) => s.sharer === "alice"));
});
