// Feeld's real "Clear app cache" (#167). This PWA's real client-side
// cache is the service worker's Cache Storage (sw.js's CACHE_NAME) —
// cached app-shell assets and the offline fallback page. Clearing it
// forces the next page load to re-fetch everything fresh. Deliberately
// leaves localStorage untouched: things like guest identity, theme,
// locale, and data-saver preference are real user settings, not cache,
// and wiping them would silently sign the user out — not what "clear
// cache" should do. The browser's own HTTP cache has no JS API to clear
// at all; that's a genuine platform limitation, not something faked here.
export async function clearAppCache(): Promise<number> {
  if (typeof caches === "undefined") return 0;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  return keys.length;
}
