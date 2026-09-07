// A fixed catalog of preset stylized-avatar ids (Bitmoji/Snapchat-style
// "cartoon" and "3D" looks) rather than actual 3D rendering or generative
// avatar creation — this app has no 3D asset pipeline or model-generation
// service, so "support" here means letting a profile pick a preset
// stylized look to show instead of their photo, with the client owning
// how each id actually renders (a static illustration/3D-rendered PNG per
// id), same scoping call as #85's fixed color-swatch themes.
export const AVATAR_STYLES = ["cartoonA", "cartoonB", "cartoonC", "threeDA", "threeDB", "threeDC"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export interface StylizedAvatarInfo {
  style: AvatarStyle | null;
  // Whether to show the stylized avatar in place of the real photo avatar
  // collected during onboarding — a user can pick a style and later switch
  // back to their photo without losing the selection.
  active: boolean;
}

export type UpdateStylizedAvatarResult =
  | { success: true; stylizedAvatarInfo: StylizedAvatarInfo }
  | { success: false; error: string };

function isAvatarStyle(value: unknown): value is AvatarStyle {
  return typeof value === "string" && (AVATAR_STYLES as readonly string[]).includes(value);
}

const EMPTY_STYLIZED_AVATAR_INFO: StylizedAvatarInfo = { style: null, active: false };

/**
 * Editable-anytime stylized (3D/cartoon) avatar selection (#89), same
 * one-value-per-author, replace-on-update shape as #67-#88's other
 * standalone profile fields.
 */
export class StylizedAvatarStore {
  private infoByAuthor = new Map<string, StylizedAvatarInfo>();

  update(author: unknown, style: unknown, active: unknown): UpdateStylizedAvatarResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    let styleValue: AvatarStyle | null = null;
    if (style !== null && style !== undefined) {
      if (!isAvatarStyle(style)) {
        return { success: false, error: `style must be one of: ${AVATAR_STYLES.join(", ")}` };
      }
      styleValue = style;
    }

    const activeValue = active === true;
    if (activeValue && !styleValue) {
      return { success: false, error: "Choose a style before activating it" };
    }

    const stylizedAvatarInfo: StylizedAvatarInfo = { style: styleValue, active: activeValue };
    this.infoByAuthor.set(authorName, stylizedAvatarInfo);
    return { success: true, stylizedAvatarInfo };
  }

  get(author: string): StylizedAvatarInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_STYLIZED_AVATAR_INFO;
  }
}
