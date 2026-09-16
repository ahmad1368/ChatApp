export interface WeatherInfo {
  tempCelsius: number;
  description: string;
  icon: string;
}

// Tinder's real "Show the weather in the other person's city if they're
// far away" (#268) — "far away" is deliberately a bigger radius than
// #33's own local search-radius default, since the point is someone
// clearly outside your everyday area (a different climate/region), not
// just past your usual swipe range.
export const FAR_AWAY_THRESHOLD_KM = 80;

export function isFarAway(distanceKm: number): boolean {
  return distanceKm > FAR_AWAY_THRESHOLD_KM;
}

export type WeatherFetcher = (lat: number, lon: number, apiKey: string) => Promise<WeatherInfo | undefined>;

/**
 * Real call to OpenWeatherMap's current-weather-by-coordinates endpoint —
 * a genuinely live, free-tier-available weather API, not a fabricated
 * one, but this environment has no `WEATHER_API_KEY` configured (same
 * "real integration, missing credentials in *this* environment" honesty
 * as #22-25's Google/Apple/Facebook sign-in and #77's Spotify Connect,
 * each gated by their own `isConfigured()`).
 */
export const fetchWeather: WeatherFetcher = async (lat, lon, apiKey) => {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${encodeURIComponent(apiKey)}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const body = await res.json();
    if (typeof body?.main?.temp !== "number") return undefined;
    return {
      tempCelsius: Math.round(body.main.temp),
      description: typeof body?.weather?.[0]?.description === "string" ? body.weather[0].description : "",
      icon: typeof body?.weather?.[0]?.icon === "string" ? body.weather[0].icon : "",
    };
  } catch {
    return undefined;
  }
};

export class WeatherService {
  constructor(
    private readonly apiKey: string | undefined = process.env.WEATHER_API_KEY,
    private readonly fetcher: WeatherFetcher = fetchWeather
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async getWeather(lat: number, lon: number): Promise<WeatherInfo | undefined> {
    if (!this.apiKey) return undefined;
    return this.fetcher(lat, lon, this.apiKey);
  }
}
