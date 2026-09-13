import test from "node:test";
import assert from "node:assert/strict";
import { reportsToCsv, reportsToPdf } from "./reportExport";
import { StoredReport } from "./reports";

function makeReport(overrides: Partial<StoredReport> = {}): StoredReport {
  return {
    id: "report-1",
    reporterAuthor: "alice",
    reportedAuthor: "bob",
    reason: "harassment",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "pending",
    ...overrides,
  };
}

test("reportsToCsv() emits a header row even with no reports", () => {
  const csv = reportsToCsv([]);
  assert.equal(csv, "id,reporterAuthor,reportedAuthor,reason,details,status,createdAt,reviewedAt,reviewedBy,resolutionNote");
});

test("reportsToCsv() emits one row per report with the right values", () => {
  const csv = reportsToCsv([makeReport()]);
  const lines = csv.split("\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[1], "report-1,alice,bob,harassment,,pending,2026-01-01T00:00:00.000Z,,,");
});

test("reportsToCsv() escapes commas, quotes, and newlines in a field", () => {
  const csv = reportsToCsv([makeReport({ details: 'Said "hi" then, left\nabruptly' })]);
  assert.match(csv, /"Said ""hi"" then, left\nabruptly"/);
});

test("reportsToPdf() resolves a real PDF buffer for an empty report list", async () => {
  const buffer = await reportsToPdf([]);
  assert.ok(buffer.length > 0);
  assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
});

test("reportsToPdf() resolves a larger PDF buffer when reports are included", async () => {
  const empty = await reportsToPdf([]);
  const withReports = await reportsToPdf([makeReport(), makeReport({ id: "report-2", reportedAuthor: "carol" })]);
  assert.ok(withReports.length > empty.length);
});
