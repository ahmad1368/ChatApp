const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

export type TranslateFetcher = (text: string, targetLang: string, apiKey: string) => Promise<string | undefined>;

interface GoogleTranslateResponse {
  data?: { translations?: { translatedText?: unknown }[] };
}

/**
 * Real fetch: Google Cloud Translation API — Bumble's real "See
 * translation" (#145) via an actual third-party integration rather than a
 * fabricated/bundled translation model, same "server proxies an external
 * API using a server-only credential" shape as giphy.ts's Giphy search.
 */
export const fetchTranslation: TranslateFetcher = async (text, targetLang, apiKey) => {
  try {
    const url = `${TRANSLATE_URL}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target: targetLang, format: "text" }),
    });
    if (!res.ok) return undefined;

    const body: GoogleTranslateResponse = await res.json();
    const translated = body?.data?.translations?.[0]?.translatedText;
    return typeof translated === "string" ? translated : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Purely opt-in via TRANSLATE_API_KEY, same "unconfigured means the
 * feature is off, not fabricated" pattern as GiphyService/SpotifyService —
 * this is a real third-party API, not something to fake translations for.
 */
export class TranslationService {
  constructor(
    private readonly apiKey: string | undefined = process.env.TRANSLATE_API_KEY,
    private readonly fetcher: TranslateFetcher = fetchTranslation
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async translate(text: string, targetLang: string): Promise<string | undefined> {
    if (!this.apiKey || !text.trim() || !targetLang.trim()) return undefined;
    return this.fetcher(text, targetLang, this.apiKey);
  }
}
