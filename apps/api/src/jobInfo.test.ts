import { test } from "node:test";
import assert from "node:assert/strict";
import { JobInfoStore, MAX_JOB_TITLE_LENGTH, MAX_COMPANY_LENGTH } from "./jobInfo";

test("get() returns empty fields before any update", () => {
  const store = new JobInfoStore();
  assert.deepEqual(store.get("alice"), { jobTitle: "", company: "", hideCompany: false });
});

test("update() rejects a missing author", () => {
  const store = new JobInfoStore();
  const result = store.update("", "Engineer", "Acme", false);
  assert.equal(result.success, false);
});

test("update() rejects a job title over the character limit", () => {
  const store = new JobInfoStore();
  const result = store.update("alice", "a".repeat(MAX_JOB_TITLE_LENGTH + 1), "Acme", false);
  assert.equal(result.success, false);
});

test("update() rejects a company over the character limit", () => {
  const store = new JobInfoStore();
  const result = store.update("alice", "Engineer", "a".repeat(MAX_COMPANY_LENGTH + 1), false);
  assert.equal(result.success, false);
});

test("update() rejects a job title containing a phone number", () => {
  const store = new JobInfoStore();
  const result = store.update("alice", "call me 555-123-4567", "Acme", false);
  assert.equal(result.success, false);
});

test("update() accepts empty job title and company", () => {
  const store = new JobInfoStore();
  const result = store.update("alice", "", "", false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { jobTitle: "", company: "", hideCompany: false });
});

test("update() accepts valid job title, company, and hideCompany, then get() returns it", () => {
  const store = new JobInfoStore();
  const result = store.update("alice", "Software Engineer", "Acme Corp", true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { jobTitle: "Software Engineer", company: "Acme Corp", hideCompany: true });
});

test("updating again replaces the previous job info for that author", () => {
  const store = new JobInfoStore();
  store.update("alice", "Engineer", "Acme", false);
  store.update("alice", "Designer", "Widgets Inc", true);
  assert.deepEqual(store.get("alice"), { jobTitle: "Designer", company: "Widgets Inc", hideCompany: true });
});

test("each author's job info is independent", () => {
  const store = new JobInfoStore();
  store.update("alice", "Engineer", "Acme", false);
  assert.deepEqual(store.get("bob"), { jobTitle: "", company: "", hideCompany: false });
});
