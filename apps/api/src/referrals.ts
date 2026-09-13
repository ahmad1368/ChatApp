import { randomBytes } from "crypto";

export const REFERRAL_REWARD_DAYS = 7;
export const REFERRAL_REWARD_TIER = "gold" as const;

export interface Referral {
  referrer: string;
  referee: string;
  redeemedAt: string;
}

export type RedeemReferralResult = { success: true; referrer: string } | { success: false; error: string };

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

/**
 * Tinder's real "Referral system to invite friends for free subscription
 * days" (#204) — a real, unique per-author code and a real two-sided
 * reward once redeemed: both the referrer and the new referee actually
 * get #191 subscription days credited via #203's
 * SubscriptionStore.extendOrGrant() (see server.ts's
 * POST /api/referrals/redeem), the same "store validates, caller
 * applies the effect" split #197-#199/#203 already use. One redemption
 * per referee ever (an author can't be referred twice, and can't
 * redeem their own code) — the real anti-abuse rule every referral
 * program needs to stop self-farming free days.
 */
export class ReferralStore {
  private codeByAuthor = new Map<string, string>();
  private authorByCode = new Map<string, string>();
  private refereesRedeemed = new Set<string>();
  private redemptions: Referral[] = [];

  getOrCreateCode(author: unknown): string | undefined {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return undefined;

    const existing = this.codeByAuthor.get(authorText);
    if (existing) return existing;

    let code = generateCode();
    while (this.authorByCode.has(code)) code = generateCode();
    this.codeByAuthor.set(authorText, code);
    this.authorByCode.set(code, authorText);
    return code;
  }

  redeem(codeInput: unknown, refereeInput: unknown): RedeemReferralResult {
    const referee = typeof refereeInput === "string" ? refereeInput.trim() : "";
    if (!referee) return { success: false, error: "author is required" };
    const code = typeof codeInput === "string" ? codeInput.trim().toUpperCase() : "";
    const referrer = this.authorByCode.get(code);
    if (!referrer) return { success: false, error: "Invalid referral code" };
    if (referrer === referee) return { success: false, error: "You can't redeem your own referral code" };
    if (this.refereesRedeemed.has(referee)) return { success: false, error: "You've already redeemed a referral code" };

    this.refereesRedeemed.add(referee);
    this.redemptions.push({ referrer, referee, redeemedAt: new Date().toISOString() });
    return { success: true, referrer };
  }

  /** How many people this author has successfully referred — for a real "X friends referred" stat, not a fabricated one. */
  getReferralCount(author: string): number {
    return this.redemptions.filter((r) => r.referrer === author).length;
  }
}
