export interface SpotifyInfo {
  connected: boolean;
  topTracks: string[];
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#76's other profile-detail hide flags.
  hideSpotify: boolean;
}

const EMPTY_SPOTIFY_INFO: SpotifyInfo = { connected: false, topTracks: [], hideSpotify: false };

/**
 * Per-author Spotify connection state (#77) — one connected account's top
 * tracks per author, replace-on-reconnect. Distinct from the enum/free-text
 * stores in #67-#76: the value here comes from an external OAuth fetch
 * (spotifyAuth.ts), not user-typed input, so there's no validation to do
 * beyond storing what that fetch returned.
 */
export class SpotifyInfoStore {
  private infoByAuthor = new Map<string, SpotifyInfo>();

  connect(author: string, topTracks: string[]): SpotifyInfo {
    const existing = this.infoByAuthor.get(author);
    const info: SpotifyInfo = { connected: true, topTracks, hideSpotify: existing?.hideSpotify ?? false };
    this.infoByAuthor.set(author, info);
    return info;
  }

  disconnect(author: string): SpotifyInfo {
    const existing = this.infoByAuthor.get(author);
    const info: SpotifyInfo = { connected: false, topTracks: [], hideSpotify: existing?.hideSpotify ?? false };
    this.infoByAuthor.set(author, info);
    return info;
  }

  setHideSpotify(author: string, hideSpotify: boolean): SpotifyInfo {
    const existing = this.infoByAuthor.get(author) ?? EMPTY_SPOTIFY_INFO;
    const info: SpotifyInfo = { ...existing, hideSpotify };
    this.infoByAuthor.set(author, info);
    return info;
  }

  get(author: string): SpotifyInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_SPOTIFY_INFO;
  }
}
