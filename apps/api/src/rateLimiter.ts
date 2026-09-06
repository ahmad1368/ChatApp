/**
 * Fixed-window rate limiter keyed by an arbitrary id (e.g. socket id). Under
 * high concurrency a single misbehaving or malicious client shouldn't be
 * able to monopolize server resources (or flood every other connected
 * client via broadcast) — this caps how often one key may act.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>();

  constructor(private readonly maxHits: number, private readonly windowMs: number) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.maxHits) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  /** Call when a client disconnects so its entry doesn't linger forever. */
  clear(key: string): void {
    this.hits.delete(key);
  }
}
