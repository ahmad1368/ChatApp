import { BackgroundCheckStatus } from "./backgroundCheck";

export interface BackgroundCheckRecord {
  status: BackgroundCheckStatus;
  candidateId: string | null;
  invitationUrl: string | null;
  requestedAt: string | null;
}

const EMPTY_RECORD: BackgroundCheckRecord = { status: "notRequested", candidateId: null, invitationUrl: null, requestedAt: null };

/**
 * Per-author record of #295's optional criminal-record background check —
 * "optional" per the issue title: nothing here ever runs without the
 * author explicitly requesting an invitation first (see server.ts's
 * POST /api/background-check/:author). The badge a profile can show
 * (`hasCleanRecordBadge()`) only lights up once Checkr's own real report
 * comes back "clear" — never on "invited"/"pending", so an in-progress
 * check is never mistaken for a passed one.
 */
export class BackgroundCheckStore {
  private recordByAuthor = new Map<string, BackgroundCheckRecord>();

  get(author: string): BackgroundCheckRecord {
    return this.recordByAuthor.get(author?.trim()) ?? EMPTY_RECORD;
  }

  recordInvitation(author: string, candidateId: string, invitationUrl: string): BackgroundCheckRecord {
    const record: BackgroundCheckRecord = { status: "invited", candidateId, invitationUrl, requestedAt: new Date().toISOString() };
    this.recordByAuthor.set(author, record);
    return record;
  }

  updateStatus(author: string, status: BackgroundCheckStatus): BackgroundCheckRecord {
    const existing = this.get(author);
    const record: BackgroundCheckRecord = { ...existing, status };
    this.recordByAuthor.set(author, record);
    return record;
  }

  hasCleanRecordBadge(author: string): boolean {
    return this.get(author).status === "clear";
  }
}
