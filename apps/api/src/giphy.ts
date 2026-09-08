const GIF_SEARCH_URL = "https://api.giphy.com/v1/gifs/search";
const STICKER_SEARCH_URL = "https://api.giphy.com/v1/stickers/search";

export const GIPHY_CONTENT_TYPES = ["gifs", "stickers"] as const;
export type GiphyContentType = (typeof GIPHY_CONTENT_TYPES)[number];

export const DEFAULT_GIPHY_LIMIT = 12;
export const MAX_GIPHY_LIMIT = 25;

export interface GiphyResult {
  id: string;
  url: string;
  previewUrl: string;
  title: string;
}

export type GiphySearchFetcher = (
  query: string,
  type: GiphyContentType,
  apiKey: string,
  limit: number
) => Promise<GiphyResult[] | undefined>;

interface GiphyApiImage {
  url?: unknown;
}

interface GiphyApiItem {
  id?: unknown;
  title?: unknown;
  images?: {
    original?: GiphyApiImage;
    fixed_width_small?: GiphyApiImage;
  };
}

/**
 * Real fetch: Giphy's public search API for GIFs or stickers — Tinder's
 * real "send a GIF/sticker" (#124) via an actual third-party integration
 * rather than a bundled/fabricated media library, same "server proxies an
 * external API using a server-only credential" shape as spotifyAuth.ts's
 * token exchange (the api_key never reaches the browser).
 */
export const fetchGiphyResults: GiphySearchFetcher = async (query, type, apiKey, limit) => {
  try {
    const baseUrl = type === "stickers" ? STICKER_SEARCH_URL : GIF_SEARCH_URL;
    const url = `${baseUrl}?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;

    const body = await res.json();
    const items: GiphyApiItem[] = Array.isArray(body?.data) ? body.data : [];
    return items
      .map((item) => {
        const id = typeof item.id === "string" || typeof item.id === "number" ? String(item.id) : "";
        const gifUrl = typeof item.images?.original?.url === "string" ? item.images.original.url : "";
        const previewUrl =
          typeof item.images?.fixed_width_small?.url === "string" ? item.images.fixed_width_small.url : gifUrl;
        const title = typeof item.title === "string" ? item.title : "";
        return { id, url: gifUrl, previewUrl, title };
      })
      .filter((result): result is GiphyResult => Boolean(result.id && result.url));
  } catch {
    return undefined;
  }
};

/**
 * Purely opt-in via GIPHY_API_KEY, same "unconfigured means the feature is
 * off, not fabricated" pattern as SpotifyService/InstagramService — this
 * is a real third-party API, not something to fake results for.
 */
export class GiphyService {
  constructor(
    private readonly apiKey: string | undefined = process.env.GIPHY_API_KEY,
    private readonly fetcher: GiphySearchFetcher = fetchGiphyResults
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, type: GiphyContentType, limit: number = DEFAULT_GIPHY_LIMIT): Promise<GiphyResult[] | undefined> {
    if (!this.apiKey) return undefined;
    const boundedLimit = Math.min(Math.max(1, limit), MAX_GIPHY_LIMIT);
    return this.fetcher(query, type, this.apiKey, boundedLimit);
  }
}
