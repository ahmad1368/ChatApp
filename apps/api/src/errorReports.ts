const MAX_STORED_REPORTS = 200;
const MAX_FIELD_LENGTH = 4000;

export interface ErrorReportInput {
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
}

export interface StoredErrorReport extends ErrorReportInput {
  id: string;
  receivedAt: string;
}

function truncate(value: string | undefined, max: number): string | undefined {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export class ErrorReportStore {
  private reports: StoredErrorReport[] = [];

  record(input: ErrorReportInput): StoredErrorReport {
    const report: StoredErrorReport = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: truncate(input.message, MAX_FIELD_LENGTH) || "Unknown error",
      stack: truncate(input.stack, MAX_FIELD_LENGTH),
      url: truncate(input.url, 2048),
      userAgent: truncate(input.userAgent, 512),
      receivedAt: new Date().toISOString(),
    };

    this.reports.push(report);
    // Bound memory usage — a real deployment would forward these to a
    // dedicated crash-reporting service instead of keeping them in-process.
    if (this.reports.length > MAX_STORED_REPORTS) {
      this.reports.shift();
    }
    return report;
  }

  count(): number {
    return this.reports.length;
  }
}
