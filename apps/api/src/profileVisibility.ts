export interface ProfileVisibility {
  hideAge: boolean;
  hideDistance: boolean;
}

export type UpdateProfileVisibilityResult =
  | { success: true; visibility: ProfileVisibility }
  | { success: false; error: string };

const DEFAULT_VISIBILITY: ProfileVisibility = { hideAge: false, hideDistance: false };

/**
 * Feeld's real "hide specific profile sections" privacy setting (#80) —
 * unlike #67-#79's per-optional-detail hide flags (job, education, height,
 * etc.), age and distance are core fields shown on every profile by
 * default, so this is its own small toggle store rather than another
 * field bundled with a value. Computing the actual age (no date-of-birth
 * field exists in this app yet) and distance (depends on a future
 * discovery/matching feature) is out of scope — this stores the
 * visibility preference a profile-rendering surface would check.
 */
export class ProfileVisibilityStore {
  private visibilityByAuthor = new Map<string, ProfileVisibility>();

  update(author: unknown, hideAge: unknown, hideDistance: unknown): UpdateProfileVisibilityResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const visibility: ProfileVisibility = { hideAge: hideAge === true, hideDistance: hideDistance === true };
    this.visibilityByAuthor.set(authorName, visibility);
    return { success: true, visibility };
  }

  get(author: string): ProfileVisibility {
    return this.visibilityByAuthor.get(author) ?? DEFAULT_VISIBILITY;
  }
}
