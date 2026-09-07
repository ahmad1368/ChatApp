const TOKEN_URL = "https://accounts.spotify.com/api/token";
const TOP_TRACKS_URL = "https://api.spotify.com/v1/me/top/tracks?limit=5";

export interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
}

export interface SpotifyProfile {
  topTracks: string[];
}

export type SpotifyTrackFetcher = (
  code: string,
  redirectUri: string,
  credentials: SpotifyCredentials
) => Promise<SpotifyProfile | undefined>;

/**
 * Real fetch: exchanges the authorization code the client obtained from
 * Spotify's OAuth redirect for an access token, then asks Spotify's Web API
 * for the user's top 5 tracks — the same "client does the OAuth redirect,
 * server verifies/fetches with the resulting code" shape as
 * googleAuth.ts/facebookAuth.ts, adapted to Spotify's authorization-code
 * flow (Spotify has no lightweight id-token-style verification endpoint).
 */
export const fetchSpotifyTopTracks: SpotifyTrackFetcher = async (code, redirectUri, { clientId, clientSecret }) => {
  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
    });
    if (!tokenRes.ok) return undefined;
    const tokenBody = await tokenRes.json();
    const accessToken = tokenBody?.access_token;
    if (typeof accessToken !== "string") return undefined;

    const tracksRes = await fetch(TOP_TRACKS_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!tracksRes.ok) return undefined;
    const tracksBody = await tracksRes.json();
    const items = Array.isArray(tracksBody?.items) ? tracksBody.items : [];
    const topTracks = items
      .map((item: { name?: unknown; artists?: Array<{ name?: unknown }> }) => {
        const trackName = typeof item?.name === "string" ? item.name : undefined;
        const artistName = typeof item?.artists?.[0]?.name === "string" ? item.artists[0].name : undefined;
        return trackName ? (artistName ? `${trackName} — ${artistName}` : trackName) : undefined;
      })
      .filter((entry: string | undefined): entry is string => Boolean(entry));

    return { topTracks };
  } catch {
    return undefined;
  }
};

export class SpotifyService {
  constructor(
    private readonly clientId: string | undefined = process.env.SPOTIFY_CLIENT_ID,
    private readonly clientSecret: string | undefined = process.env.SPOTIFY_CLIENT_SECRET,
    private readonly fetcher: SpotifyTrackFetcher = fetchSpotifyTopTracks
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async fetchTopTracks(code: string, redirectUri: string): Promise<SpotifyProfile | undefined> {
    if (!this.clientId || !this.clientSecret) return undefined;
    return this.fetcher(code, redirectUri, { clientId: this.clientId, clientSecret: this.clientSecret });
  }
}
