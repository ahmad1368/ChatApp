import { MIN_SEARCH_RADIUS_KM, MAX_SEARCH_RADIUS_KM } from "@chatapp/shared";

export interface DiscoveryBoundaries {
  minRadiusKm: number;
  maxRadiusKm: number;
  defaultRadiusKm: number;
}

export type UpdateBoundariesResult = { success: true; boundaries: DiscoveryBoundaries } | { success: false; error: string };

const INITIAL_BOUNDARIES: DiscoveryBoundaries = {
  minRadiusKm: MIN_SEARCH_RADIUS_KM,
  maxRadiusKm: MAX_SEARCH_RADIUS_KM,
  defaultRadiusKm: 25,
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * Bumble's real "Set default geographic boundaries and discovery radii"
 * (#183) — turns onboarding.ts's `searchRadius` step from validating
 * against fixed, code-defined MIN_SEARCH_RADIUS_KM/MAX_SEARCH_RADIUS_KM
 * constants into validating against a real, admin-adjustable range, plus
 * a real platform-wide default a fresh onboarding radius picker starts
 * from. A single shared setting (not per-author), same "one global
 * admin-controlled configuration" shape as adminMetrics.ts's admin-key
 * gate, gated the same admin-key way as #171-182.
 */
export class DiscoveryBoundariesStore {
  private boundaries: DiscoveryBoundaries = { ...INITIAL_BOUNDARIES };

  get(): DiscoveryBoundaries {
    return { ...this.boundaries };
  }

  update(minRadiusKm: unknown, maxRadiusKm: unknown, defaultRadiusKm: unknown): UpdateBoundariesResult {
    if (!isPositiveInteger(minRadiusKm)) {
      return { success: false, error: "minRadiusKm must be a positive integer" };
    }
    if (!isPositiveInteger(maxRadiusKm) || maxRadiusKm < minRadiusKm) {
      return { success: false, error: "maxRadiusKm must be an integer greater than or equal to minRadiusKm" };
    }
    if (!isPositiveInteger(defaultRadiusKm) || defaultRadiusKm < minRadiusKm || defaultRadiusKm > maxRadiusKm) {
      return { success: false, error: "defaultRadiusKm must be an integer between minRadiusKm and maxRadiusKm" };
    }

    this.boundaries = { minRadiusKm, maxRadiusKm, defaultRadiusKm };
    return { success: true, boundaries: this.get() };
  }
}
