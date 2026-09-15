export const MAX_ALT_TEXT_LENGTH = 250;

export type SetAltTextResult = { success: true; altText: string } | { success: false; error: string };

/**
 * Bumble's real "Text descriptions on photos (Alt Text) for
 * accessibility" (#245): a real, author-written description per photo
 * that a screen reader actually announces in place of a generic
 * "Profile photo" — same keyed-by-owner+photoId decoupling as #112's
 * PhotoInteractionStore, so this doesn't need to import PhotoAlbumStore
 * directly. An empty alt text (never set, or cleared) is a valid state —
 * `getAltText()` returning undefined lets the UI fall back to a generic
 * label honestly, rather than fabricating a description no one wrote.
 */
export class PhotoAltTextStore {
  private altTextByPhoto = new Map<string, string>();

  private key(owner: string, photoId: string): string {
    return `${owner} ${photoId}`;
  }

  setAltText(owner: unknown, photoId: unknown, altText: unknown): SetAltTextResult {
    const ownerName = typeof owner === "string" ? owner.trim() : "";
    if (!ownerName) return { success: false, error: "owner is required" };

    const id = typeof photoId === "string" ? photoId.trim() : "";
    if (!id) return { success: false, error: "photoId is required" };

    const text = typeof altText === "string" ? altText.trim() : "";
    if (text.length > MAX_ALT_TEXT_LENGTH) {
      return { success: false, error: `altText must be ${MAX_ALT_TEXT_LENGTH} characters or fewer` };
    }

    const key = this.key(ownerName, id);
    if (text) {
      this.altTextByPhoto.set(key, text);
    } else {
      this.altTextByPhoto.delete(key);
    }
    return { success: true, altText: text };
  }

  getAltText(owner: string, photoId: string): string | undefined {
    return this.altTextByPhoto.get(this.key(owner, photoId));
  }
}
