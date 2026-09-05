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
- Block users and prevent re-encountering them (#42): mutual, high-priority block/unblock API independent of any matching/discovery service; blocked pairs stop receiving each other's messages both in real time (per-socket Socket.io delivery filtering) and in message history; block list is per-user and self-lookup only (no endpoint reveals who has blocked a given user). Mobile screenshot-blocking (Android `FLAG_SECURE`) and image watermarking from the reference app's implementation guide are native-app/media concerns out of scope for this web-first PWA and are deferred.
- Block phone contacts (#43): users can self-declare a phone number (stored only as a SHA-256 hash, never in plaintext) and upload a contact list to auto-block any other author whose registered phone matches, reusing the same mutual `BlockStore` as manual blocking. Web UI uses the Contact Picker API where supported (Chrome for Android) and falls back to manual number entry elsewhere (desktop/iOS have no bulk contact-export API) — the same web-first substitute pattern as #42's deferred native screenshot-blocking.
