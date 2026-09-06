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
- Complete account and data deletion (GDPR erasure) — `DELETE /api/account/:author`, web page at `/privacy`
- Download a backup of personal data (GDPR export) — `GET /api/account/:author/export`, web download page at `/privacy/export`
- Hide exact location and show only an approximation (~5km) — `PUT`/`GET /api/users/:author/location`, web page at `/privacy/location`
- Full PWA support for the browser — web app manifest, installable icons, and an offline-capable service worker with an offline fallback page
