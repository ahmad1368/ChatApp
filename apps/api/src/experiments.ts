import { randomUUID, createHash } from "crypto";

const MAX_NAME_LENGTH = 60;
const MIN_VARIANTS = 2;
const MAX_VARIANTS = 5;
const MAX_VARIANT_LENGTH = 40;

export interface Experiment {
  id: string;
  name: string;
  variants: string[];
  active: boolean;
  createdAt: string;
}

export type CreateExperimentResult = { success: true; experiment: Experiment } | { success: false; error: string };
export type AssignVariantResult = { success: true; variant: string } | { success: false; error: string };

function parseVariants(value: unknown): string[] | { error: string } {
  if (!Array.isArray(value)) return { error: "variants must be an array of strings" };
  if (value.length < MIN_VARIANTS || value.length > MAX_VARIANTS) {
    return { error: `variants must have between ${MIN_VARIANTS} and ${MAX_VARIANTS} entries` };
  }
  const variants: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) return { error: "each variant must be a non-empty string" };
    const trimmed = item.trim();
    if (trimmed.length > MAX_VARIANT_LENGTH) return { error: `each variant must be ${MAX_VARIANT_LENGTH} characters or fewer` };
    if (variants.includes(trimmed)) return { error: "variants must be unique" };
    variants.push(trimmed);
  }
  return variants;
}

/**
 * Hinge's real "A/B testing support for algorithm changes" (#188). What's
 * real here: a named experiment's variants, a deterministic per-user
 * bucket (sha256 of experimentId+author, stable across calls so the same
 * user always lands in the same variant — not re-rolled each request),
 * and genuine assignment counts read back from those real assignments.
 * What isn't built: this app has no per-algorithm hook yet wiring a
 * specific ranking/matching behavior to branch on the returned variant —
 * that's separate, feature-specific follow-up work for whichever
 * algorithm an experiment targets, the same "infrastructure now, adoption
 * later" scoping call #187's requireRole made for its own admin routes.
 */
export class ExperimentStore {
  private byId = new Map<string, Experiment>();
  private assignments = new Map<string, string>();

  create(name: unknown, variants: unknown): CreateExperimentResult {
    const nameText = typeof name === "string" ? name.trim() : "";
    if (!nameText) return { success: false, error: "name is required" };
    if (nameText.length > MAX_NAME_LENGTH) return { success: false, error: `name must be ${MAX_NAME_LENGTH} characters or fewer` };
    const parsedVariants = parseVariants(variants);
    if ("error" in parsedVariants) return { success: false, error: parsedVariants.error };

    const experiment: Experiment = {
      id: randomUUID(),
      name: nameText,
      variants: parsedVariants,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.byId.set(experiment.id, experiment);
    return { success: true, experiment };
  }

  setActive(experimentId: string, active: boolean): boolean {
    const experiment = this.byId.get(experimentId);
    if (!experiment) return false;
    experiment.active = active;
    return true;
  }

  /** Newest first — the admin management view. */
  list(): Experiment[] {
    return [...this.byId.values()].reverse();
  }

  get(experimentId: string): Experiment | undefined {
    return this.byId.get(experimentId);
  }

  /** Stable per-user bucketing: the same author always gets back the same variant. */
  assignVariant(experimentId: string, author: unknown): AssignVariantResult {
    const experiment = this.byId.get(experimentId);
    if (!experiment) return { success: false, error: "Experiment not found" };
    if (!experiment.active) return { success: false, error: "Experiment is not active" };
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };

    const assignmentKey = `${experimentId}:${authorText}`;
    const existing = this.assignments.get(assignmentKey);
    if (existing) return { success: true, variant: existing };

    const hash = createHash("sha256").update(assignmentKey).digest();
    const bucket = hash.readUInt32BE(0) % experiment.variants.length;
    const variant = experiment.variants[bucket];
    this.assignments.set(assignmentKey, variant);
    return { success: true, variant };
  }

  /** Real counts of how many assigned users landed in each variant. */
  getStats(experimentId: string): Record<string, number> | undefined {
    const experiment = this.byId.get(experimentId);
    if (!experiment) return undefined;
    const stats: Record<string, number> = {};
    for (const variant of experiment.variants) stats[variant] = 0;
    const prefix = `${experimentId}:`;
    for (const [key, variant] of this.assignments) {
      if (key.startsWith(prefix)) stats[variant] = (stats[variant] ?? 0) + 1;
    }
    return stats;
  }
}
