import { randomUUID } from "crypto";

export const BILLING_PERIODS = ["monthly", "yearly"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

const MAX_NAME_LENGTH = 60;
const MAX_FEATURES = 20;
const MAX_FEATURE_LENGTH = 120;

export interface PricingPlan {
  id: string;
  name: string;
  priceCents: number;
  billingPeriod: BillingPeriod;
  features: string[];
  active: boolean;
  createdAt: string;
}

export type CreatePlanResult = { success: true; plan: PricingPlan } | { success: false; error: string };
export type UpdatePlanResult = { success: true; plan: PricingPlan } | { success: false; error: string };

export interface PlanUpdate {
  name?: unknown;
  priceCents?: unknown;
  billingPeriod?: unknown;
  features?: unknown;
  active?: unknown;
}

function isBillingPeriod(value: unknown): value is BillingPeriod {
  return typeof value === "string" && (BILLING_PERIODS as readonly string[]).includes(value);
}

function parseFeatures(value: unknown): string[] | { error: string } {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return { error: "features must be an array of strings" };
  if (value.length > MAX_FEATURES) return { error: `features must be ${MAX_FEATURES} or fewer` };
  const features: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) return { error: "each feature must be a non-empty string" };
    if (item.trim().length > MAX_FEATURE_LENGTH) return { error: `each feature must be ${MAX_FEATURE_LENGTH} characters or fewer` };
    features.push(item.trim());
  }
  return features;
}

/**
 * Bumble's real "Manage financial plans, pricing and discount codes"
 * (#177) — the admin-management half of that pair (see discountCodes.ts
 * for the other). This app has no real payment processor to charge
 * against (same disclosed gap as #105/#106's free Boost — "no premium
 * tier to gate it behind"), so a plan here is informational pricing data
 * an admin curates and users can browse, not a live billing product.
 */
export class PricingPlanStore {
  private plansById = new Map<string, PricingPlan>();

  create(name: unknown, priceCents: unknown, billingPeriod: unknown, features: unknown): CreatePlanResult {
    const nameText = typeof name === "string" ? name.trim() : "";
    if (!nameText) return { success: false, error: "name is required" };
    if (nameText.length > MAX_NAME_LENGTH) return { success: false, error: `name must be ${MAX_NAME_LENGTH} characters or fewer` };
    if (typeof priceCents !== "number" || !Number.isFinite(priceCents) || priceCents < 0 || !Number.isInteger(priceCents)) {
      return { success: false, error: "priceCents must be a non-negative integer" };
    }
    if (!isBillingPeriod(billingPeriod)) {
      return { success: false, error: `billingPeriod must be one of: ${BILLING_PERIODS.join(", ")}` };
    }
    const parsedFeatures = parseFeatures(features);
    if ("error" in parsedFeatures) return { success: false, error: parsedFeatures.error };

    const plan: PricingPlan = {
      id: randomUUID(),
      name: nameText,
      priceCents,
      billingPeriod,
      features: parsedFeatures,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.plansById.set(plan.id, plan);
    return { success: true, plan };
  }

  update(planId: string, changes: PlanUpdate): UpdatePlanResult {
    const plan = this.plansById.get(planId);
    if (!plan) return { success: false, error: "Plan not found" };

    const next: PricingPlan = { ...plan };
    if (changes.name !== undefined) {
      const nameText = typeof changes.name === "string" ? changes.name.trim() : "";
      if (!nameText) return { success: false, error: "name is required" };
      if (nameText.length > MAX_NAME_LENGTH) return { success: false, error: `name must be ${MAX_NAME_LENGTH} characters or fewer` };
      next.name = nameText;
    }
    if (changes.priceCents !== undefined) {
      if (
        typeof changes.priceCents !== "number" ||
        !Number.isFinite(changes.priceCents) ||
        changes.priceCents < 0 ||
        !Number.isInteger(changes.priceCents)
      ) {
        return { success: false, error: "priceCents must be a non-negative integer" };
      }
      next.priceCents = changes.priceCents;
    }
    if (changes.billingPeriod !== undefined) {
      if (!isBillingPeriod(changes.billingPeriod)) {
        return { success: false, error: `billingPeriod must be one of: ${BILLING_PERIODS.join(", ")}` };
      }
      next.billingPeriod = changes.billingPeriod;
    }
    if (changes.features !== undefined) {
      const parsedFeatures = parseFeatures(changes.features);
      if ("error" in parsedFeatures) return { success: false, error: parsedFeatures.error };
      next.features = parsedFeatures;
    }
    if (changes.active !== undefined) {
      if (typeof changes.active !== "boolean") return { success: false, error: "active must be a boolean" };
      next.active = changes.active;
    }

    this.plansById.set(planId, next);
    return { success: true, plan: next };
  }

  /** Every plan, newest first — the admin management view. Map insertion
   *  order tracks creation order, so this is exact even when two plans
   *  are created in the same millisecond (createdAt alone wouldn't be). */
  list(): PricingPlan[] {
    return [...this.plansById.values()].reverse();
  }

  /** Only active plans, cheapest first — what a pricing page shows real users. */
  listActive(): PricingPlan[] {
    return this.list()
      .filter((plan) => plan.active)
      .sort((a, b) => a.priceCents - b.priceCents);
  }

  get(planId: string): PricingPlan | undefined {
    return this.plansById.get(planId);
  }
}
