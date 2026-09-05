// Minimal service worker whose job here is to exist and be updatable — it's
// what makes the in-app update flow in UpdateNotifier.tsx possible. Caching
// strategy lives in #1's PWA work; merge that in alongside this.
//
// Deliberately does NOT call skipWaiting() on install: a new worker must sit
// in the "waiting" state so UpdateNotifier can prompt the user before
// activating it, rather than silently swapping the app out from under them.

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
