import { REPORT_THRESHOLD } from "./fakeProfileDetector";

/**
 * Bumble's real "Private Detector" AI photo warning (#144): whether an
 * image message's sender is a real safety signal this app already
 * tracks — reusing fakeProfileDetector.ts's REPORT_THRESHOLD/ReportStore
 * rather than inspecting the actual pixel content, since this app has no
 * trained NSFW-image classifier or vision-model API key. Same "reuse an
 * existing signal instead of fabricating one" precedent as #107's
 * fakeProfileDetector reusing the same report-count signal.
 */
export function isSenderPhotoSuspicious(reportCount: number): boolean {
  return reportCount >= REPORT_THRESHOLD;
}
