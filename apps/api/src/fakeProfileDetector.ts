import { scanForSpamContent } from "./spamDetector";

// A handful of reports is normal noise (a bad match, a bad joke); this
// many independent reports against the same profile is a real signal.
export const REPORT_THRESHOLD = 3;

export type FakeProfileReason = "reported" | "spam_bio" | "duplicate_photo";

export interface FakeProfileScanResult {
  flagged: boolean;
  reasons: FakeProfileReason[];
}

export interface CandidateProfileSignals {
  bio: string;
  reportCount: number;
  hasDuplicatePhoto: boolean;
}

/**
 * Bumble's real "remove spam and fake profiles from the like queue"
 * (#107): a small, explainable combination of two signals this app
 * already collects, reused rather than reinvented — same honesty stance
 * as #106's peak-hours histogram, no fabricated ML model:
 *
 *  - `reportCount` >= REPORT_THRESHOLD: reuses ReportStore.countFor(),
 *    already documented there as intended for future moderation tooling.
 *  - the candidate's bio matches spamDetector.ts's existing promo-
 *    phrase/URL heuristic, already used to catch spam in chat messages —
 *    the same patterns work whether the text is a message or a bio.
 *  - #267's `hasDuplicatePhoto`: the candidate has uploaded a profile
 *    photo whose exact bytes another author has also uploaded, reusing
 *    duplicatePhotoDetection.ts's real hash-based exact-duplicate check
 *    (not a fabricated reverse-image-search integration).
 *
 * Deliberately does NOT re-check phone/address content: bio.ts already
 * rejects that at write time, so a stored bio can never contain it.
 *
 * A candidate is only ever excluded from being *shown* in the like queue
 * (see server.ts's isExcludedCandidate) — never banned, reported to
 * anyone, or otherwise penalized — so a false positive is reversible
 * just by the report count aging out of relevance or the bio being
 * edited.
 */
export function scanCandidateForFakeProfile(signals: CandidateProfileSignals): FakeProfileScanResult {
  const reasons: FakeProfileReason[] = [];
  if (signals.reportCount >= REPORT_THRESHOLD) {
    reasons.push("reported");
  }
  if (scanForSpamContent(signals.bio).flagged) {
    reasons.push("spam_bio");
  }
  if (signals.hasDuplicatePhoto) {
    reasons.push("duplicate_photo");
  }
  return { flagged: reasons.length > 0, reasons };
}
