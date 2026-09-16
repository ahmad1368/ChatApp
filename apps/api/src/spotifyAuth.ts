const TOKEN_URL = "https://accounts.spotify.com/api/token";
const TOP_TRACKS_URL = "https://api.spotify.com/v1/me/top/tracks?limit=5";
const AUDIO_FEATURES_URL = "https://api.spotify.com/v1/audio-features";

export interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
}

export interface SpotifyProfile {
  topTracks: string[];
  // #293's "System to analyze mood compatibility based on music" — the
  // average valence (musical positiveness)/energy across the same top
  // tracks above, from Spotify's real Audio Features API. null when that
  // second call fails/returns nothing, so mood compatibility is honestly
  // "unknown" rather than defaulted to a fabricated midpoint.
  moodValence: number | null;
  moodEnergy: number | null;
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

    const trackIds = items
      .map((item: { id?: unknown }) => (typeof item?.id === "string" ? item.id : undefined))
      .filter((id: string | undefined): id is string => Boolean(id));

    const { moodValence, moodEnergy } = await fetchMoodAverages(trackIds, accessToken);

    return { topTracks, moodValence, moodEnergy };
  } catch {
    return undefined;
  }
};

/** Real call to Spotify's Audio Features API — returns null averages (never throws) if it fails, so a mood-averages failure doesn't fail the whole top-tracks fetch. */
async function fetchMoodAverages(trackIds: string[], accessToken: string): Promise<{ moodValence: number | null; moodEnergy: number | null }> {
  if (trackIds.length === 0) return { moodValence: null, moodEnergy: null };
  try {
    const featuresRes = await fetch(`${AUDIO_FEATURES_URL}?ids=${trackIds.join(",")}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!featuresRes.ok) return { moodValence: null, moodEnergy: null };
    const featuresBody = await featuresRes.json();
    const features = Array.isArray(featuresBody?.audio_features) ? featuresBody.audio_features : [];
    const valid = features.filter(
      (f: { valence?: unknown; energy?: unknown } | null) => typeof f?.valence === "number" && typeof f?.energy === "number"
    );
    if (valid.length === 0) return { moodValence: null, moodEnergy: null };
    const moodValence = valid.reduce((sum: number, f: { valence: number }) => sum + f.valence, 0) / valid.length;
    const moodEnergy = valid.reduce((sum: number, f: { energy: number }) => sum + f.energy, 0) / valid.length;
    return { moodValence, moodEnergy };
  } catch {
    return { moodValence: null, moodEnergy: null };
  }
}

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
