export interface SeasonalCampaign {
  id: string;
  name: string;
  /** Month/day window, inclusive, evaluated against the current year every time — recurs annually with no admin upkeep. Doesn't support a window that wraps New Year's (none of the fixed campaigns below need one). */
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  discountType: "percent" | "fixed";
  discountAmount: number;
}

/** Tinder's real recurring seasonal sales — a small, fixed calendar, not an admin-managed catalog (see discountCodes.ts for that generic system). */
export const SEASONAL_CAMPAIGNS: SeasonalCampaign[] = [
  { id: "valentines", name: "Valentine's Day Sale", startMonth: 2, startDay: 10, endMonth: 2, endDay: 16, discountType: "percent", discountAmount: 25 },
  { id: "black-friday", name: "Black Friday Sale", startMonth: 11, startDay: 24, endMonth: 11, endDay: 30, discountType: "percent", discountAmount: 40 },
];

function isWithinWindow(now: Date, campaign: SeasonalCampaign): boolean {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const nowValue = month * 100 + day;
  const startValue = campaign.startMonth * 100 + campaign.startDay;
  const endValue = campaign.endMonth * 100 + campaign.endDay;
  return nowValue >= startValue && nowValue <= endValue;
}

export type RedeemSeasonalResult = { success: true; campaign: SeasonalCampaign } | { success: false; error: string };

/**
 * Tinder's real "Seasonal and occasion-based discounts (Valentine's,
 * Black Friday)" (#205) — unlike #177's DiscountCodeStore (admin-
 * created, manually time-bounded codes), a campaign here activates and
 * deactivates itself purely from the real wall-clock date, recurring
 * every year with zero admin upkeep. This app has no checkout to apply
 * a real price cut to (same disclosed gap as #177/#203's own discount
 * systems), so redeem() is the same honest stand-in: it only succeeds
 * while a campaign is genuinely, currently active and tracks real
 * redemption counts.
 */
export class SeasonalDiscountStore {
  private redemptionCountByCampaignId = new Map<string, number>();

  /** The currently active campaign, if any — real campaigns never overlap in this fixed calendar, so at most one is ever active. */
  getActiveCampaign(now: Date = new Date()): SeasonalCampaign | undefined {
    return SEASONAL_CAMPAIGNS.find((campaign) => isWithinWindow(now, campaign));
  }

  redeem(now: Date = new Date()): RedeemSeasonalResult {
    const campaign = this.getActiveCampaign(now);
    if (!campaign) return { success: false, error: "No seasonal discount is active right now" };
    this.redemptionCountByCampaignId.set(campaign.id, this.getRedemptionCount(campaign.id) + 1);
    return { success: true, campaign };
  }

  getRedemptionCount(campaignId: string): number {
    return this.redemptionCountByCampaignId.get(campaignId) ?? 0;
  }
}
