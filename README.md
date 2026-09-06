# ChatApp

A real-time chat application built incrementally from the project's 500-feature issue backlog, one issue at a time via the `/next-issue` workflow.

## Stack

- **Monorepo:** npm workspaces (`apps/*`, `packages/*`)
- **Web:** Next.js (App Router) + TypeScript, PWA-first
- **API:** Node.js + Express + Socket.io (real-time messaging)
- **Shared:** `@chatapp/shared` — types and constants shared between web and API

See `CLAUDE.md` for scope decisions and the issue-implementation workflow.

## Getting started

```bash
npm install
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

## Implemented so far

- Baseline real-time chat (single room, Socket.io) — web UI + API scaffold
- #2 Real-time sync between mobile and web — reconnect/catch-up sync (`since` query param) so clients recover missed messages after a dropped connection, plus a live sync-status indicator
- #3 Responsive design for tablet and desktop — CSS custom properties + media-query breakpoints replace fixed inline layout
- #4 Local push-style notifications — Notification API alerts for new messages while the tab is backgrounded (foreground/open-tab equivalent of mobile push; full Web Push tracked separately in #5)
- #5 Web Push notifications — VAPID-backed subscribe/notify flow (service worker `push` handler, `/api/push/*` endpoints) so new messages can be delivered even when the tab is fully closed
- #6 Offline-first mode and data cache management — localStorage message cache for instant load, plus an outgoing-message queue that flushes automatically on reconnect
- #7 Battery and data usage optimization — WebSocket-only transport, tuned reconnection backoff, Data Saver opt-in, and auto-disconnect after the tab is hidden for 2 minutes
- #8 Dark / Light Mode support — CSS custom-property theme tokens, system-preference default, and a manual override toggle persisted in localStorage
- #9 Multilingual (i18n) and RTL/LTR support — English/Persian translations with a language switcher that flips `lang`/`dir` on `<html>` (RTL for Persian)
- #10 Deep linking — `/room/[roomId]` routing plus `?m=<messageId>` links that scroll to and highlight a specific message, with a per-message "copy link" action
- #11 Optimized REST API — backward-compatible cursor pagination (`limit`/`before`) on the messages endpoint, with a "Load older messages" client flow, instead of always shipping full room history
- #12 Image sharing with automatic compression — client-side canvas downscale/re-encode before upload, in-memory upload store, images rendered inline in the chat
- #13 CDN readiness for static assets — `NEXT_PUBLIC_CDN_URL`-driven `assetPrefix` plus immutable cache headers (build output and uploaded images), so a CDN can front the app without code changes
- #14 OS shortcuts integration — web app manifest `shortcuts` entry so installed PWAs get a jump-list/long-press shortcut into the app
- #15 Smooth 60fps swipe-to-reply — Pointer Events + transform/rAF-only dragging on message bubbles, swipe right to quote-reply
- #16 Keyboard shortcuts — Ctrl/Cmd+K to focus the composer, Shift+Enter for a new line, Esc to dismiss, and `?` for a shortcuts help overlay
- #17 Automatic crash/error reporting — global error/rejection handlers plus a React error boundary report to `/api/error-reports`, the web equivalent of Crashlytics
- Complete account and data deletion (GDPR erasure) — `DELETE /api/account/:author`, web page at `/privacy`
- Download a backup of personal data (GDPR export) — `GET /api/account/:author/export`, web download page at `/privacy/export`
- Hide exact location and show only an approximation (~5km) — `PUT`/`GET /api/users/:author/location`, web page at `/privacy/location`
- Full PWA support for the browser — web app manifest, installable icons, and an offline-capable service worker with an offline fallback page
