export interface SpotifyInfo {
  connected: boolean;
  topTracks: string[];
  // #326's "Show a list of shared favorite artists" — the account's real
  // top 5 artists from Spotify's own top-artists endpoint (see
  // spotifyAuth.ts), distinct from the per-track artist folded into each
  // topTracks entry above.
  topArtists: string[];
  // #293's "System to analyze mood compatibility based on music" — real
  // averaged Spotify Audio Features (see spotifyAuth.ts), null when that
  // second API call failed/returned nothing.
  moodValence: number | null;
  moodEnergy: number | null;
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#76's other profile-detail hide flags.
  hideSpotify: boolean;
}

const EMPTY_SPOTIFY_INFO: SpotifyInfo = {
  connected: false,
  topTracks: [],
  topArtists: [],
  moodValence: null,
  moodEnergy: null,
  hideSpotify: false,
};

/**
 * Per-author Spotify connection state (#77) — one connected account's top
 * tracks/artists per author, replace-on-reconnect. Distinct from the enum/
 * free-text stores in #67-#76: the value here comes from an external OAuth
 * fetch (spotifyAuth.ts), not user-typed input, so there's no validation to
 * do beyond storing what that fetch returned.
 */
export class SpotifyInfoStore {
  private infoByAuthor = new Map<string, SpotifyInfo>();

  connect(
    author: string,
    topTracks: string[],
    moodValence: number | null = null,
    moodEnergy: number | null = null,
    topArtists: string[] = []
  ): SpotifyInfo {
    const existing = this.infoByAuthor.get(author);
    const info: SpotifyInfo = {
      connected: true,
      topTracks,
      topArtists,
      moodValence,
      moodEnergy,
      hideSpotify: existing?.hideSpotify ?? false,
    };
    this.infoByAuthor.set(author, info);
    return info;
  }

  disconnect(author: string): SpotifyInfo {
    const existing = this.infoByAuthor.get(author);
    const info: SpotifyInfo = {
      connected: false,
      topTracks: [],
      topArtists: [],
      moodValence: null,
      moodEnergy: null,
      hideSpotify: existing?.hideSpotify ?? false,
    };
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
