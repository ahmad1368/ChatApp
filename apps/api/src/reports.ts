import { randomUUID } from "crypto";
import { REPORT_REASONS, ReportPayload, ReportReason } from "@chatapp/shared";

const MAX_DETAILS_LENGTH = 500;
const MAX_REPORTS_PER_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export interface StoredReport {
  id: string;
  reporterAuthor: string;
  reportedAuthor: string;
  messageId?: string;
  reason: ReportReason;
  details?: string;
  createdAt: string;
}

export type SubmitReportResult = { success: true; report: StoredReport } | { success: false; error: string };

function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

/**
 * Report is a safety-critical action: implemented as its own small,
 * dependency-free store (no coupling to chat history, uploads, or any
 * other subsystem) so it stays available even if something else in the
 * app is degraded — "no dependency on heavier services", per the issue's
 * implementation guide.
 */
export class ReportStore {
  private reports: StoredReport[] = [];
  private submissionsByReporter = new Map<string, number[]>();

  private isRateLimited(reporterAuthor: string): boolean {
    const now = Date.now();
    const timestamps = (this.submissionsByReporter.get(reporterAuthor) ?? []).filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS
    );
    this.submissionsByReporter.set(reporterAuthor, timestamps);
    return timestamps.length >= MAX_REPORTS_PER_WINDOW;
  }

  submit(reporterAuthor: string, payload: Partial<ReportPayload>): SubmitReportResult {
    if (!reporterAuthor.trim()) return { success: false, error: "reporterAuthor is required" };
    if (typeof payload.reportedAuthor !== "string" || !payload.reportedAuthor.trim()) {
      return { success: false, error: "reportedAuthor is required" };
    }
    if (!isReportReason(payload.reason)) {
      return { success: false, error: `reason must be one of: ${REPORT_REASONS.join(", ")}` };
    }
    if (payload.details !== undefined && typeof payload.details !== "string") {
      return { success: false, error: "details must be a string" };
    }
    if (payload.details && payload.details.length > MAX_DETAILS_LENGTH) {
      return { success: false, error: `details must be ${MAX_DETAILS_LENGTH} characters or fewer` };
    }
    if (this.isRateLimited(reporterAuthor)) {
      return { success: false, error: "Too many reports submitted recently — please try again later" };
    }

    const report: StoredReport = {
      id: randomUUID(),
      reporterAuthor,
      reportedAuthor: payload.reportedAuthor,
      messageId: payload.messageId,
      reason: payload.reason,
      details: payload.details?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    this.reports.push(report);
    this.submissionsByReporter.set(reporterAuthor, [...(this.submissionsByReporter.get(reporterAuthor) ?? []), Date.now()]);
    return { success: true, report };
  }

  // Internal-only accessor for tests/future moderation tooling — not wired
  // to any HTTP route. Reports contain claims about other users and must
  // not be exposed over an unauthenticated API.
  countFor(reportedAuthor: string): number {
    return this.reports.filter((r) => r.reportedAuthor === reportedAuthor).length;
  }
}
