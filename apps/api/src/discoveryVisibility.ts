const MAX_FIELD_LENGTH = 80;

export interface DiscoveryVisibilityPreferences {
  city: string;
  workplace: string;
  hideFromSameCity: boolean;
  hideFromSameWorkplace: boolean;
}

export type SetPreferencesResult =
  | { success: true; preferences: DiscoveryVisibilityPreferences }
  | { success: false; error: string };

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function defaults(): DiscoveryVisibilityPreferences {
  return { city: "", workplace: "", hideFromSameCity: false, hideFromSameWorkplace: false };
}

/**
 * Bumble's real "hide my profile from members of my workplace/school"
 * feature, generalized here to a self-reported city too. There's no
 * discovery/matching feature in this app yet (same scoping as #33's
 * search radius, stored on the profile long before any "nearby" feature
 * consumes it) — this stores the preference and provides the pure
 * visibility check a future discovery feature would call before showing
 * one account's profile to another.
 */
export class DiscoveryVisibilityStore {
  private preferencesByUserId = new Map<string, DiscoveryVisibilityPreferences>();

  getPreferences(userId: string): DiscoveryVisibilityPreferences {
    return this.preferencesByUserId.get(userId) ?? defaults();
  }

  setPreferences(userId: string, input: unknown): SetPreferencesResult {
    const { city, workplace, hideFromSameCity, hideFromSameWorkplace } = (
      typeof input === "object" && input !== null ? input : {}
    ) as {
      city?: unknown;
      workplace?: unknown;
      hideFromSameCity?: unknown;
      hideFromSameWorkplace?: unknown;
    };

    const cityValue = typeof city === "string" ? city.trim() : "";
    const workplaceValue = typeof workplace === "string" ? workplace.trim() : "";
    if (cityValue.length > MAX_FIELD_LENGTH || workplaceValue.length > MAX_FIELD_LENGTH) {
      return { success: false, error: `city and workplace must be ${MAX_FIELD_LENGTH} characters or fewer` };
    }

    const preferences: DiscoveryVisibilityPreferences = {
      city: cityValue,
      workplace: workplaceValue,
      hideFromSameCity: hideFromSameCity === true,
      hideFromSameWorkplace: hideFromSameWorkplace === true,
    };
    this.preferencesByUserId.set(userId, preferences);
    return { success: true, preferences };
  }

  /** Pure check a future discovery/matching feature calls before showing targetUserId's profile to viewerUserId. */
  isVisibleTo(targetUserId: string, viewerUserId: string): boolean {
    if (targetUserId === viewerUserId) return true;
    const target = this.getPreferences(targetUserId);
    const viewer = this.getPreferences(viewerUserId);

    if (target.hideFromSameCity && target.city && viewer.city && normalize(target.city) === normalize(viewer.city)) {
      return false;
    }
    if (
      target.hideFromSameWorkplace &&
      target.workplace &&
      viewer.workplace &&
      normalize(target.workplace) === normalize(viewer.workplace)
    ) {
      return false;
    }
    return true;
  }
}
