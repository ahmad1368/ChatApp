import test from "node:test";
import assert from "node:assert/strict";
import { SeasonalDiscountStore } from "./seasonalDiscounts";

test("getActiveCampaign() finds Valentine's Day Sale within its window", () => {
  const store = new SeasonalDiscountStore();
  const campaign = store.getActiveCampaign(new Date(2026, 1, 14)); // Feb 14
  assert.equal(campaign?.id, "valentines");
});

test("getActiveCampaign() finds Black Friday Sale within its window", () => {
  const store = new SeasonalDiscountStore();
  const campaign = store.getActiveCampaign(new Date(2026, 10, 27)); // Nov 27
  assert.equal(campaign?.id, "black-friday");
});

test("getActiveCampaign() returns undefined outside any campaign window", () => {
  const store = new SeasonalDiscountStore();
  assert.equal(store.getActiveCampaign(new Date(2026, 5, 15)), undefined); // June 15
});

test("getActiveCampaign() respects the exact boundary days, inclusive", () => {
  const store = new SeasonalDiscountStore();
  assert.equal(store.getActiveCampaign(new Date(2026, 1, 10))?.id, "valentines"); // Feb 10, start
  assert.equal(store.getActiveCampaign(new Date(2026, 1, 16))?.id, "valentines"); // Feb 16, end
  assert.equal(store.getActiveCampaign(new Date(2026, 1, 9)), undefined); // Feb 9, before
  assert.equal(store.getActiveCampaign(new Date(2026, 1, 17)), undefined); // Feb 17, after
});

test("getActiveCampaign() recurs every year regardless of the year value", () => {
  const store = new SeasonalDiscountStore();
  assert.equal(store.getActiveCampaign(new Date(2020, 1, 14))?.id, "valentines");
  assert.equal(store.getActiveCampaign(new Date(2030, 1, 14))?.id, "valentines");
});

test("redeem() fails when no campaign is active", () => {
  const store = new SeasonalDiscountStore();
  const result = store.redeem(new Date(2026, 5, 15));
  assert.equal(result.success, false);
});

test("redeem() succeeds during an active campaign and tracks a real redemption count", () => {
  const store = new SeasonalDiscountStore();
  const first = store.redeem(new Date(2026, 1, 14));
  assert.equal(first.success, true);
  assert.equal(first.success && first.campaign.id, "valentines");
  assert.equal(store.getRedemptionCount("valentines"), 1);

  store.redeem(new Date(2026, 1, 15));
  assert.equal(store.getRedemptionCount("valentines"), 2);
});

test("getRedemptionCount() is 0 for a campaign never redeemed", () => {
  const store = new SeasonalDiscountStore();
  assert.equal(store.getRedemptionCount("valentines"), 0);
});
