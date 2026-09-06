import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReportStore } from "./reports";

describe("ReportStore", () => {
  it("accepts a valid report", () => {
    const store = new ReportStore();
    const result = store.submit("alice", { reportedAuthor: "bob", reason: "harassment" });
    assert.ok(result.success);
    assert.equal(store.countFor("bob"), 1);
  });

  it("rejects a missing reporter", () => {
    const store = new ReportStore();
    const result = store.submit("", { reportedAuthor: "bob", reason: "spam" });
    assert.equal(result.success, false);
  });

  it("rejects a missing reportedAuthor", () => {
    const store = new ReportStore();
    const result = store.submit("alice", { reason: "spam" });
    assert.equal(result.success, false);
  });

  it("rejects an invalid reason", () => {
    const store = new ReportStore();
    const result = store.submit("alice", { reportedAuthor: "bob", reason: "not-a-real-reason" as never });
    assert.equal(result.success, false);
  });

  it("rejects details over the length cap", () => {
    const store = new ReportStore();
    const result = store.submit("alice", { reportedAuthor: "bob", reason: "other", details: "x".repeat(501) });
    assert.equal(result.success, false);
  });

  it("accepts optional messageId and details", () => {
    const store = new ReportStore();
    const result = store.submit("alice", {
      reportedAuthor: "bob",
      reason: "inappropriateContent",
      messageId: "msg-1",
      details: "Sent an explicit image",
    });
    assert.ok(result.success);
    assert.equal(result.report.messageId, "msg-1");
    assert.equal(result.report.details, "Sent an explicit image");
  });

  it("rate-limits a reporter after too many submissions in the window", () => {
    const store = new ReportStore();
    for (let i = 0; i < 10; i++) {
      const result = store.submit("alice", { reportedAuthor: `user-${i}`, reason: "spam" });
      assert.ok(result.success);
    }
    const eleventh = store.submit("alice", { reportedAuthor: "user-10", reason: "spam" });
    assert.equal(eleventh.success, false);
  });

  it("tracks report counts independently per reported user", () => {
    const store = new ReportStore();
    store.submit("alice", { reportedAuthor: "bob", reason: "spam" });
    store.submit("carol", { reportedAuthor: "bob", reason: "harassment" });
    assert.equal(store.countFor("bob"), 2);
    assert.equal(store.countFor("dave"), 0);
  });
});
