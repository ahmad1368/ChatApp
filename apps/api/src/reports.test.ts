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

  it("a new report starts pending", () => {
    const store = new ReportStore();
    const result = store.submit("alice", { reportedAuthor: "bob", reason: "spam" });
    assert.ok(result.success);
    assert.equal(result.report.status, "pending");
  });

  it("getReportedUsersQueue() groups pending reports by reported author, sorted by pending count", () => {
    const store = new ReportStore();
    store.submit("alice", { reportedAuthor: "bob", reason: "spam" });
    store.submit("carol", { reportedAuthor: "dave", reason: "harassment" });
    store.submit("erin", { reportedAuthor: "dave", reason: "scam" });

    const queue = store.getReportedUsersQueue();
    assert.deepEqual(
      queue.map((e) => ({ reportedAuthor: e.reportedAuthor, pendingCount: e.pendingCount })),
      [
        { reportedAuthor: "dave", pendingCount: 2 },
        { reportedAuthor: "bob", pendingCount: 1 },
      ]
    );
  });

  it("getReportedUsersQueue() excludes reports already reviewed", () => {
    const store = new ReportStore();
    const submitted = store.submit("alice", { reportedAuthor: "bob", reason: "spam" });
    assert.ok(submitted.success);
    store.review(submitted.report.id, "admin", "dismissed", undefined);

    assert.deepEqual(store.getReportedUsersQueue(), []);
  });

  it("review() rejects a missing reportId", () => {
    const store = new ReportStore();
    const result = store.review("", "admin", "resolved", undefined);
    assert.deepEqual(result, { success: false, error: "reportId is required" });
  });

  it("review() rejects a missing reviewer", () => {
    const store = new ReportStore();
    const submitted = store.submit("alice", { reportedAuthor: "bob", reason: "spam" });
    assert.ok(submitted.success);
    const result = store.review(submitted.report.id, "", "resolved", undefined);
    assert.deepEqual(result, { success: false, error: "reviewer is required" });
  });

  it("review() rejects an invalid status", () => {
    const store = new ReportStore();
    const submitted = store.submit("alice", { reportedAuthor: "bob", reason: "spam" });
    assert.ok(submitted.success);
    const result = store.review(submitted.report.id, "admin", "ignored", undefined);
    assert.deepEqual(result, { success: false, error: "status must be 'resolved' or 'dismissed'" });
  });

  it("review() 404s for an unknown report", () => {
    const store = new ReportStore();
    const result = store.review("nope", "admin", "resolved", undefined);
    assert.deepEqual(result, { success: false, error: "Report not found" });
  });

  it("review() records the reviewer, timestamp, and optional note", () => {
    const store = new ReportStore();
    const submitted = store.submit("alice", { reportedAuthor: "bob", reason: "spam" });
    assert.ok(submitted.success);
    const result = store.review(submitted.report.id, "admin", "resolved", "Warned the user");
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.report.status, "resolved");
      assert.equal(result.report.reviewedBy, "admin");
      assert.equal(result.report.resolutionNote, "Warned the user");
      assert.ok(result.report.reviewedAt);
    }
  });
});
