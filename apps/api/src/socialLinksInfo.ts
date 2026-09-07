export const SOCIAL_PLATFORMS = ["twitter", "tiktok", "youtube", "linkedin", "website"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const MAX_URL_LENGTH = 200;

export type SocialLinks = { [K in SocialPlatform]: string };

export interface SocialLinksInfo {
  links: SocialLinks;
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#82's other profile-detail hide flags.
  hideSocialLinks: boolean;
}

export type UpdateSocialLinksInfoResult =
  | { success: true; socialLinksInfo: SocialLinksInfo }
  | { success: false; error: string };

function emptyLinks(): SocialLinks {
  return { twitter: "", tiktok: "", youtube: "", linkedin: "", website: "" };
}

function isValidUrl(value: string): boolean {
  if (value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

const EMPTY_SOCIAL_LINKS_INFO: SocialLinksInfo = { links: emptyLinks(), hideSocialLinks: false };

/**
 * Editable-anytime social media links (#83), same one-value-per-author,
 * replace-on-update shape as #67-#82's other standalone profile fields.
 * Unlike #77/#78's Spotify/Instagram "connect" flows, these are just
 * self-reported URLs the profile owner types in — no OAuth, no fetched
 * content — so validation is limited to "is this an https:// URL", the
 * same trust level as a bio or display name.
 */
export class SocialLinksInfoStore {
  private infoByAuthor = new Map<string, SocialLinksInfo>();

  update(author: unknown, links: unknown, hideSocialLinks: unknown): UpdateSocialLinksInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const input = typeof links === "object" && links !== null ? (links as Record<string, unknown>) : {};
    const validated = emptyLinks();
    for (const platform of SOCIAL_PLATFORMS) {
      const raw = input[platform];
      if (raw === undefined || raw === null || raw === "") continue;
      if (typeof raw !== "string" || !isValidUrl(raw)) {
        return { success: false, error: `${platform} must be a valid https:// URL` };
      }
      validated[platform] = raw;
    }

    const socialLinksInfo: SocialLinksInfo = { links: validated, hideSocialLinks: hideSocialLinks === true };
    this.infoByAuthor.set(authorName, socialLinksInfo);
    return { success: true, socialLinksInfo };
  }

  get(author: string): SocialLinksInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_SOCIAL_LINKS_INFO;
  }
}
