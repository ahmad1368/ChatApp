import { test } from "node:test";
import assert from "node:assert/strict";
import { EmailDomainBlockStore } from "./emailDomainBlock";

test("registerEmail() rejects a missing author or an invalid email", () => {
  const store = new EmailDomainBlockStore();
  assert.equal(store.registerEmail("", "alice@example.com").success, false);
  assert.equal(store.registerEmail("alice", "not-an-email").success, false);
  assert.equal(store.registerEmail("alice", "alice@example.com").success, true);
});

test("findMatchingAuthors() matches by domain regardless of local part or casing", () => {
  const store = new EmailDomainBlockStore();
  store.registerEmail("bob", "bob@Acme.com");

  const matches = store.findMatchingAuthors("alice", ["acme.com"]);
  assert.deepEqual(matches, ["bob"]);
});

test("findMatchingAuthors() accepts a domain with a leading @", () => {
  const store = new EmailDomainBlockStore();
  store.registerEmail("bob", "bob@acme.com");

  const matches = store.findMatchingAuthors("alice", ["@acme.com"]);
  assert.deepEqual(matches, ["bob"]);
});

test("findMatchingAuthors() never returns the requesting author themself", () => {
  const store = new EmailDomainBlockStore();
  store.registerEmail("alice", "alice@acme.com");

  const matches = store.findMatchingAuthors("alice", ["acme.com"]);
  assert.deepEqual(matches, []);
});

test("findMatchingAuthors() dedupes and ignores non-string/empty entries", () => {
  const store = new EmailDomainBlockStore();
  store.registerEmail("bob", "bob@acme.com");
  store.registerEmail("carol", "carol@acme.com");

  const matches = store.findMatchingAuthors("alice", ["acme.com", "ACME.com", "", 12345, null]).sort();
  assert.deepEqual(matches, ["bob", "carol"]);
});

test("findMatchingAuthors() only matches a registered domain, not unrelated ones", () => {
  const store = new EmailDomainBlockStore();
  store.registerEmail("bob", "bob@acme.com");

  assert.deepEqual(store.findMatchingAuthors("alice", ["other.com"]), []);
});

test("registerEmail() re-registering moves the old domain mapping", () => {
  const store = new EmailDomainBlockStore();
  store.registerEmail("bob", "bob@acme.com");
  store.registerEmail("bob", "bob@newjob.com");

  assert.deepEqual(store.findMatchingAuthors("alice", ["acme.com"]), []);
  assert.deepEqual(store.findMatchingAuthors("alice", ["newjob.com"]), ["bob"]);
});
