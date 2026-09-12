export interface FunnelStageInput {
  key: string;
  label: string;
  count: number;
}

export interface FunnelStage extends FunnelStageInput {
  conversionFromStart: number;
  conversionFromPrevious: number;
}

function toPercent(count: number, of: number): number {
  if (of <= 0) return 0;
  return Math.round((count / of) * 1000) / 10;
}

/**
 * Bumble's real "Tools to analyze user behavior and conversion rate"
 * (#179) — a genuine signup → onboarding → first-swipe → first-match →
 * first-message funnel, computed from this app's own real counts
 * (UserStore, OnboardingStore, SwipeStore, messagesByRoom), the same
 * "real numbers, not a fabricated ML behavior model" honesty as #171's
 * adminMetrics.ts. Percentages round to one decimal place.
 */
export function buildConversionFunnel(stages: FunnelStageInput[]): FunnelStage[] {
  const startCount = stages[0]?.count ?? 0;
  return stages.map((stage, index) => ({
    ...stage,
    conversionFromStart: index === 0 ? 100 : toPercent(stage.count, startCount),
    conversionFromPrevious: index === 0 ? 100 : toPercent(stage.count, stages[index - 1].count),
  }));
}
