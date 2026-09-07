export interface InstagramInfo {
  connected: boolean;
  posts: string[];
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#77's other profile-detail hide flags.
  hideInstagram: boolean;
}

const EMPTY_INSTAGRAM_INFO: InstagramInfo = { connected: false, posts: [], hideInstagram: false };

/**
 * Per-author Instagram connection state (#78) — same shape as #77's
 * SpotifyInfoStore: one connected account's latest posts per author,
 * replace-on-reconnect, the value coming from an external OAuth fetch
 * (instagramAuth.ts) rather than user-typed input.
 */
export class InstagramInfoStore {
  private infoByAuthor = new Map<string, InstagramInfo>();

  connect(author: string, posts: string[]): InstagramInfo {
    const existing = this.infoByAuthor.get(author);
    const info: InstagramInfo = { connected: true, posts, hideInstagram: existing?.hideInstagram ?? false };
    this.infoByAuthor.set(author, info);
    return info;
  }

  disconnect(author: string): InstagramInfo {
    const existing = this.infoByAuthor.get(author);
    const info: InstagramInfo = { connected: false, posts: [], hideInstagram: existing?.hideInstagram ?? false };
    this.infoByAuthor.set(author, info);
    return info;
  }

  setHideInstagram(author: string, hideInstagram: boolean): InstagramInfo {
    const existing = this.infoByAuthor.get(author) ?? EMPTY_INSTAGRAM_INFO;
    const info: InstagramInfo = { ...existing, hideInstagram };
    this.infoByAuthor.set(author, info);
    return info;
  }

  get(author: string): InstagramInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_INSTAGRAM_INFO;
  }
}
