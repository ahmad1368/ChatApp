import { test } from "node:test";
import assert from "node:assert/strict";
import { SocialLinksInfoStore } from "./socialLinksInfo";

const EMPTY_LINKS = { twitter: "", tiktok: "", youtube: "", linkedin: "", website: "" };

test("get() returns empty links before any update", () => {
  const store = new SocialLinksInfoStore();
  assert.deepEqual(store.get("alice"), { links: EMPTY_LINKS, hideSocialLinks: false });
});

test("update() rejects a missing author", () => {
  const store = new SocialLinksInfoStore();
  const result = store.update("", { twitter: "https://twitter.com/alice" }, false);
  assert.equal(result.success, false);
});

test("update() rejects a non-https URL", () => {
  const store = new SocialLinksInfoStore();
  const result = store.update("alice", { website: "http://example.com" }, false);
  assert.equal(result.success, false);
});

test("update() rejects a malformed URL", () => {
  const store = new SocialLinksInfoStore();
  const result = store.update("alice", { website: "not a url" }, false);
  assert.equal(result.success, false);
});

test("update() rejects a URL over the max length", () => {
  const store = new SocialLinksInfoStore();
  const result = store.update("alice", { website: `https://example.com/${"a".repeat(200)}` }, false);
  assert.equal(result.success, false);
});

test("update() ignores unknown platform keys", () => {
  const store = new SocialLinksInfoStore();
  const result = store.update("alice", { myspace: "https://myspace.com/alice" }, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { links: EMPTY_LINKS, hideSocialLinks: false });
});

test("update() accepts valid links for multiple platforms and hideSocialLinks", () => {
  const store = new SocialLinksInfoStore();
  const result = store.update(
    "alice",
    { twitter: "https://twitter.com/alice", website: "https://alice.dev" },
    true
  );
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    links: { ...EMPTY_LINKS, twitter: "https://twitter.com/alice", website: "https://alice.dev" },
    hideSocialLinks: true,
  });
});

test("updating again replaces the previous links for that author", () => {
  const store = new SocialLinksInfoStore();
  store.update("alice", { twitter: "https://twitter.com/alice" }, false);
  store.update("alice", { youtube: "https://youtube.com/@alice" }, false);
  assert.deepEqual(store.get("alice"), { links: { ...EMPTY_LINKS, youtube: "https://youtube.com/@alice" }, hideSocialLinks: false });
});

test("each author's social links are independent", () => {
  const store = new SocialLinksInfoStore();
  store.update("alice", { twitter: "https://twitter.com/alice" }, false);
  assert.deepEqual(store.get("bob"), { links: EMPTY_LINKS, hideSocialLinks: false });
});
