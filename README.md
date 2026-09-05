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
- Screenshot/DRM policy (#44): browsers have no API to block or even detect an OS-level screenshot (no equivalent of Android `FLAG_SECURE`/iOS screen-capture protection exists on web), so this implements the honest web mitigation — deterrence + traceability. `POST /api/watermark/session` issues a per-viewing-session trace code (`WatermarkStore`, never exposed via a read endpoint); the client renders it as a faint tiled watermark over the chat. The UI also blurs chat content on tab-blur/visibility-change as defense-in-depth against shoulder-surfing/screen-share leaks. True screenshot prevention is deferred as a native-only capability per CLAUDE.md's web-first scoping.
