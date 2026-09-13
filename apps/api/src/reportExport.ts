import PDFDocument from "pdfkit";
import { StoredReport } from "./reports";

const CSV_COLUMNS: (keyof StoredReport)[] = [
  "id",
  "reporterAuthor",
  "reportedAuthor",
  "reason",
  "details",
  "status",
  "createdAt",
  "reviewedAt",
  "reviewedBy",
  "resolutionNote",
];

function escapeCsvField(value: unknown): string {
  const text = value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Bumble's real "Export reports in CSV and PDF format" (#190) — the
 * moderation reports #41/#172/#173 already collect, made downloadable
 * for an admin's own record-keeping/compliance needs rather than only
 * viewable in the review queue UI.
 */
export function reportsToCsv(reports: StoredReport[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = reports.map((report) => CSV_COLUMNS.map((column) => escapeCsvField(report[column])).join(","));
  return [header, ...rows].join("\n");
}

export function reportsToPdf(reports: StoredReport[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text("Moderation reports export", { align: "left" });
    doc.fontSize(10).fillColor("gray").text(`Generated ${new Date().toISOString()} · ${reports.length} report(s)`);
    doc.moveDown();

    if (reports.length === 0) {
      doc.fontSize(11).fillColor("black").text("No reports have been filed.");
    }
    for (const report of reports) {
      doc
        .fontSize(11)
        .fillColor("black")
        .text(`${report.reportedAuthor} reported by ${report.reporterAuthor} — ${report.reason}`, { continued: false });
      doc
        .fontSize(9)
        .fillColor("gray")
        .text(`${report.status} · filed ${report.createdAt}${report.details ? ` · ${report.details}` : ""}`);
      doc.moveDown(0.5);
    }

    doc.end();
  });
}
