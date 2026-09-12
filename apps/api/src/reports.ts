import { randomUUID } from "crypto";
import { REPORT_REASONS, ReportPayload, ReportReason } from "@chatapp/shared";

const MAX_DETAILS_LENGTH = 500;
const MAX_REPORTS_PER_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export const REPORT_REVIEW_STATUSES = ["pending", "resolved", "dismissed"] as const;
export type ReportReviewStatus = (typeof REPORT_REVIEW_STATUSES)[number];

export interface StoredReport {
  id: string;
  reporterAuthor: string;
  reportedAuthor: string;
  messageId?: string;
  reason: ReportReason;
  details?: string;
  createdAt: string;
  status: ReportReviewStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  resolutionNote?: string;
}

export interface ReportedUserQueueEntry {
  reportedAuthor: string;
  pendingCount: number;
  reports: StoredReport[];
}

export type SubmitReportResult = { success: true; report: StoredReport } | { success: false; error: string };
export type ReviewReportResult = { success: true; report: StoredReport } | { success: false; error: string };

function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

function isReviewDecision(value: unknown): value is "resolved" | "dismissed" {
  return value === "resolved" || value === "dismissed";
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
      status: "pending",
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

  /** Total reports ever filed — for #171's admin dashboard, gated behind the admin key, not a public route. */
  getTotalCount(): number {
    return this.reports.length;
  }

  /**
   * Bumble's real "Reported users management (Reported Users Queue)"
   * (#173) — groups still-pending reports by the reported author (not a
   * flat report-by-report list) so an admin reviews one troublesome
   * account at a time, sorted by pending-report count highest first —
   * the same real "auto-prioritize by report severity" the implementation
   * guide asks for, using this app's own genuine report counts rather
   * than a fabricated ML severity score (same honest scoping as #172's
   * photo review queue reusing this exact signal).
   */
  getReportedUsersQueue(): ReportedUserQueueEntry[] {
    const pendingByAuthor = new Map<string, StoredReport[]>();
    for (const report of this.reports) {
      if (report.status !== "pending") continue;
      const existing = pendingByAuthor.get(report.reportedAuthor) ?? [];
      existing.push(report);
      pendingByAuthor.set(report.reportedAuthor, existing);
    }
    return [...pendingByAuthor.entries()]
      .map(([reportedAuthor, reports]) => ({ reportedAuthor, pendingCount: reports.length, reports }))
      .sort((a, b) => b.pendingCount - a.pendingCount);
  }

  /** The actual admin decision on one report: resolved (action taken) or dismissed (no action needed). */
  review(reportId: unknown, reviewer: unknown, status: unknown, note: unknown): ReviewReportResult {
    const id = typeof reportId === "string" ? reportId.trim() : "";
    const reviewerName = typeof reviewer === "string" ? reviewer.trim() : "";
    if (!id) {
      return { success: false, error: "reportId is required" };
    }
    if (!reviewerName) {
      return { success: false, error: "reviewer is required" };
    }
    if (!isReviewDecision(status)) {
      return { success: false, error: "status must be 'resolved' or 'dismissed'" };
    }
    const report = this.reports.find((r) => r.id === id);
    if (!report) {
      return { success: false, error: "Report not found" };
    }

    report.status = status;
    report.reviewedAt = new Date().toISOString();
    report.reviewedBy = reviewerName;
    report.resolutionNote = typeof note === "string" && note.trim() ? note.trim() : undefined;
    return { success: true, report: { ...report } };
  }
}
