export const MIN_AGE = 18;
export const MAX_AGE = 100;

export type UpdateAgeInfoResult = { success: true; age: number | null } | { success: false; error: string };

/**
 * A real, self-reported age (#312's prerequisite) — same one-value-per-
 * author, replace-on-update shape as #69's heightInfo.ts. This app has no
 * ID-verification vendor integration (see verification.ts's selfie-only
 * scoping), so this is honestly self-reported, not government-ID-
 * verified — the real minimum of 18 is still enforced server-side, but a
 * dishonest self-report can't be caught here. Display (#80's hideAge
 * toggle) is a separate concern from this store, which only holds the
 * underlying value.
 */
export class AgeInfoStore {
  private ageByAuthor = new Map<string, number>();

  update(author: unknown, age: unknown): UpdateAgeInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (age === null) {
      this.ageByAuthor.delete(authorName);
      return { success: true, age: null };
    }
    if (typeof age !== "number" || !Number.isInteger(age)) {
      return { success: false, error: "age must be a whole number" };
    }
    if (age < MIN_AGE || age > MAX_AGE) {
      return { success: false, error: `age must be between ${MIN_AGE} and ${MAX_AGE}` };
    }
    this.ageByAuthor.set(authorName, age);
    return { success: true, age };
  }

  get(author: string): number | null {
    return this.ageByAuthor.get(author) ?? null;
  }
}
