import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ErrorReportStore } from "./errorReports";

describe("ErrorReportStore", () => {
  it("truncates overly long fields", () => {
    const store = new ErrorReportStore();
    const report = store.record({ message: "x".repeat(5000), stack: "y".repeat(5000) });
    assert.ok(report.message.length <= 4001);
    assert.ok(report.stack!.length <= 4001);
  });

  it("defaults a missing message", () => {
    const store = new ErrorReportStore();
    const report = store.record({ message: "" });
    assert.equal(report.message, "Unknown error");
  });

  it("caps stored reports at 200, dropping the oldest", () => {
    const store = new ErrorReportStore();
    for (let i = 0; i < 205; i++) {
      store.record({ message: `error ${i}` });
    }
    assert.equal(store.count(), 200);
  });
});
