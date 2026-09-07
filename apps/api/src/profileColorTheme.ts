// A fixed set of named accent-color themes for the profile card — distinct
// from ThemeToggle.tsx's app-wide light/dark UI theme, this is a per-profile
// cosmetic choice shown to other users, same idea as Tinder's colored
// profile card accents.
export const PROFILE_COLOR_THEMES = ["classic", "sunset", "ocean", "blossom", "midnight", "citrus"] as const;
export type ProfileColorTheme = (typeof PROFILE_COLOR_THEMES)[number];

export type SetProfileColorThemeResult =
  | { success: true; theme: ProfileColorTheme }
  | { success: false; error: string };

const DEFAULT_THEME: ProfileColorTheme = "classic";

function isProfileColorTheme(value: unknown): value is ProfileColorTheme {
  return typeof value === "string" && (PROFILE_COLOR_THEMES as readonly string[]).includes(value);
}

/**
 * Editable-anytime profile color theme (#85), same one-value-per-author,
 * replace-on-update shape as #67-#84's other standalone profile fields. A
 * fixed-choice enum with no "hide" concept — every profile has some theme.
 */
export class ProfileColorThemeStore {
  private themeByAuthor = new Map<string, ProfileColorTheme>();

  set(author: unknown, theme: unknown): SetProfileColorThemeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!isProfileColorTheme(theme)) {
      return { success: false, error: `theme must be one of: ${PROFILE_COLOR_THEMES.join(", ")}` };
    }

    this.themeByAuthor.set(authorName, theme);
    return { success: true, theme };
  }

  get(author: string): ProfileColorTheme {
    return this.themeByAuthor.get(author) ?? DEFAULT_THEME;
  }
}
