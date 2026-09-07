import { test } from "node:test";
import assert from "node:assert/strict";
import { ContactsGraphStore } from "./contactsGraph";

test("uploadContacts() rejects a missing author", () => {
  const store = new ContactsGraphStore();
  assert.deepEqual(store.uploadContacts("", ["555-1111"]), { success: false, error: "author is required" });
});

test("uploadContacts() rejects a non-array phoneNumbers", () => {
  const store = new ContactsGraphStore();
  assert.deepEqual(store.uploadContacts("alice", "555-1111"), {
    success: false,
    error: "phoneNumbers must be an array",
  });
});

test("uploadContacts() reports the deduped contact count", () => {
  const store = new ContactsGraphStore();
  const result = store.uploadContacts("alice", ["555-1111", "555-2222", "555-1111"]);
  assert.deepEqual(result, { success: true, contactCount: 2 });
});

test("uploadContacts() ignores non-string and blank entries", () => {
  const store = new ContactsGraphStore();
  const result = store.uploadContacts("alice", ["555-1111", "", 42, null]);
  assert.deepEqual(result, { success: true, contactCount: 1 });
});

test("getSharedContactCount() is 0 before either author uploads contacts", () => {
  const store = new ContactsGraphStore();
  assert.equal(store.getSharedContactCount("alice", "bob"), 0);
});

test("getSharedContactCount() counts phone numbers present in both authors' lists", () => {
  const store = new ContactsGraphStore();
  store.uploadContacts("alice", ["555-1111", "555-2222", "555-3333"]);
  store.uploadContacts("bob", ["555-2222", "555-3333", "555-4444"]);
  assert.equal(store.getSharedContactCount("alice", "bob"), 2);
});

test("getSharedContactCount() normalizes phone formatting the same way on both sides", () => {
  const store = new ContactsGraphStore();
  store.uploadContacts("alice", ["(555) 111-2222"]);
  store.uploadContacts("bob", ["555-111-2222"]);
  assert.equal(store.getSharedContactCount("alice", "bob"), 1);
});

test("getSharedContactCount() is 0 when only one author has uploaded contacts", () => {
  const store = new ContactsGraphStore();
  store.uploadContacts("alice", ["555-1111"]);
  assert.equal(store.getSharedContactCount("alice", "bob"), 0);
});

test("uploading new contacts replaces an author's previous list rather than merging", () => {
  const store = new ContactsGraphStore();
  store.uploadContacts("alice", ["555-1111"]);
  store.uploadContacts("bob", ["555-1111"]);
  assert.equal(store.getSharedContactCount("alice", "bob"), 1);

  store.uploadContacts("alice", ["555-9999"]);
  assert.equal(store.getSharedContactCount("alice", "bob"), 0);
});
