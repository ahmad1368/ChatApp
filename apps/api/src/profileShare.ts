import { randomBytes } from "crypto";

const REACTIONS = ["like", "pass"] as const;
export type ProfileShareReaction = (typeof REACTIONS)[number];
const MAX_COMMENT_LENGTH = 300;
const MAX_NAME_LENGTH = 40;

export interface ProfileShareOpinion {
  commenterName: string;
  reaction: ProfileShareReaction;
  comment: string;
  createdAt: string;
}

export interface ProfileShare {
  shareCode: string;
  sharer: string;
  candidateAuthor: string;
  createdAt: string;
  opinions: ProfileShareOpinion[];
}

export type CreateProfileShareResult = { success: true; share: ProfileShare } | { success: false; error: string };
export type AddOpinionResult = { success: true; share: ProfileShare } | { success: false; error: string };

function isReaction(value: unknown): value is ProfileShareReaction {
  return typeof value === "string" && (REACTIONS as readonly string[]).includes(value);
}

/**
 * Tinder's real "Ask your friends"/"Ability to share a profile with a
 * friend for their opinion" (#264) — a shareable link a friend can open
 * without an account (same no-auth, share-code pattern as #46/#47's
 * SharedDateStore) to see a candidate's public profile preview and leave
 * a quick reaction plus an optional comment. Sharing the same candidate
 * again reuses the existing share (and its accumulated opinions) rather
 * than minting a fresh code every time, so "check back for opinions" is
 * just re-sharing the same profile.
 */
export class ProfileShareStore {
  private sharesByCode = new Map<string, ProfileShare>();
  private codeBySharerAndCandidate = new Map<string, string>();

  private pairKey(sharer: string, candidateAuthor: string): string {
    return `${sharer}::${candidateAuthor}`;
  }

  create(sharer: unknown, candidateAuthor: unknown): CreateProfileShareResult {
    const sharerName = typeof sharer === "string" ? sharer.trim() : "";
    const candidateName = typeof candidateAuthor === "string" ? candidateAuthor.trim() : "";
    if (!sharerName || !candidateName) {
      return { success: false, error: "sharer and candidateAuthor are required" };
    }
    if (sharerName === candidateName) {
      return { success: false, error: "You can't share your own profile with yourself" };
    }

    const pairKey = this.pairKey(sharerName, candidateName);
    const existingCode = this.codeBySharerAndCandidate.get(pairKey);
    if (existingCode) {
      return { success: true, share: this.sharesByCode.get(existingCode)! };
    }

    const share: ProfileShare = {
      shareCode: randomBytes(4).toString("hex"),
      sharer: sharerName,
      candidateAuthor: candidateName,
      createdAt: new Date().toISOString(),
      opinions: [],
    };
    this.sharesByCode.set(share.shareCode, share);
    this.codeBySharerAndCandidate.set(pairKey, share.shareCode);
    return { success: true, share };
  }

  getByShareCode(shareCode: string): ProfileShare | undefined {
    return this.sharesByCode.get(shareCode);
  }

  addOpinion(shareCode: string, commenterName: unknown, reaction: unknown, comment: unknown): AddOpinionResult {
    const share = this.sharesByCode.get(shareCode);
    if (!share) {
      return { success: false, error: "Shared profile not found" };
    }
    if (!isReaction(reaction)) {
      return { success: false, error: `reaction must be one of: ${REACTIONS.join(", ")}` };
    }
    const name = typeof commenterName === "string" ? commenterName.trim().slice(0, MAX_NAME_LENGTH) : "";
    if (!name) {
      return { success: false, error: "commenterName is required" };
    }
    const commentText = typeof comment === "string" ? comment.trim().slice(0, MAX_COMMENT_LENGTH) : "";

    share.opinions.push({ commenterName: name, reaction, comment: commentText, createdAt: new Date().toISOString() });
    return { success: true, share };
  }

  /** Every profile this author has ever shared, most recent first — so they can check back for friends' opinions. */
  getSharesBySharer(sharer: string): ProfileShare[] {
    return Array.from(this.sharesByCode.values())
      .filter((share) => share.sharer === sharer)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
