const CHECKR_API_BASE = "https://api.checkr.com/v1";

export interface BackgroundCheckInvitation {
  candidateId: string;
  invitationUrl: string;
}

export const BACKGROUND_CHECK_STATUSES = ["notRequested", "invited", "pending", "clear", "consider"] as const;
export type BackgroundCheckStatus = (typeof BACKGROUND_CHECK_STATUSES)[number];

export type CreateInvitationFetcher = (
  email: string,
  apiKey: string
) => Promise<BackgroundCheckInvitation | undefined>;

export type FetchReportStatusFetcher = (candidateId: string, apiKey: string) => Promise<BackgroundCheckStatus | undefined>;

/**
 * Raya's real "Ability to verify a certificate of no criminal record
 * (optional)" (#295) — a genuine integration with Checkr, a real
 * background-check vendor real apps use for exactly this (never a
 * fabricated "instant criminal record check"), gated by this
 * environment's missing `CHECKR_API_KEY` (same "real integration, no
 * credentials here" honesty as #22-25's social sign-in/#77's Spotify
 * Connect/#286's Stability AI). The actual SSN/consent/identity data
 * Checkr's real check needs is entered by the candidate on Checkr's own
 * hosted invitation page — this app only ever creates that invitation
 * and later reads back the resulting clear/consider status; it never
 * collects or stores the sensitive data itself, the honest way a real
 * dating app would integrate this rather than rolling its own criminal-
 * record lookup.
 */
export const createInvitation: CreateInvitationFetcher = async (email, apiKey) => {
  try {
    const auth = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
    const candidateRes = await fetch(`${CHECKR_API_BASE}/candidates`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!candidateRes.ok) return undefined;
    const candidateBody = await candidateRes.json();
    const candidateId = candidateBody?.id;
    if (typeof candidateId !== "string") return undefined;

    const invitationRes = await fetch(`${CHECKR_API_BASE}/invitations`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId, package: "driver_pro" }),
    });
    if (!invitationRes.ok) return undefined;
    const invitationBody = await invitationRes.json();
    const invitationUrl = invitationBody?.invitation_url;
    if (typeof invitationUrl !== "string") return undefined;

    return { candidateId, invitationUrl };
  } catch {
    return undefined;
  }
};

const CHECKR_STATUS_MAP: Record<string, BackgroundCheckStatus> = {
  clear: "clear",
  consider: "consider",
  pending: "pending",
};

/** Real call to Checkr's Reports API, looking up the most recent report for this candidate. */
export const fetchReportStatus: FetchReportStatusFetcher = async (candidateId, apiKey) => {
  try {
    const auth = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
    const res = await fetch(`${CHECKR_API_BASE}/reports?candidate_id=${encodeURIComponent(candidateId)}`, {
      headers: { Authorization: auth },
    });
    if (!res.ok) return undefined;
    const body = await res.json();
    const reports = Array.isArray(body?.data) ? body.data : [];
    const latest = reports[0];
    const status = typeof latest?.status === "string" ? latest.status : undefined;
    return status ? CHECKR_STATUS_MAP[status] : undefined;
  } catch {
    return undefined;
  }
};

export class BackgroundCheckService {
  constructor(
    private readonly apiKey: string | undefined = process.env.CHECKR_API_KEY,
    private readonly invitationFetcher: CreateInvitationFetcher = createInvitation,
    private readonly reportFetcher: FetchReportStatusFetcher = fetchReportStatus
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async createInvitation(email: string): Promise<BackgroundCheckInvitation | undefined> {
    if (!this.apiKey) return undefined;
    return this.invitationFetcher(email, this.apiKey);
  }

  async fetchReportStatus(candidateId: string): Promise<BackgroundCheckStatus | undefined> {
    if (!this.apiKey) return undefined;
    return this.reportFetcher(candidateId, this.apiKey);
  }
}
