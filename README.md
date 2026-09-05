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
- Custom photo watermarking to prevent photo theft (#45): `PhotoStore` (5MB cap, jpeg/png/webp) + `POST /api/photos` upload; `GET /api/photos/:id` dynamically burns a viewer-labeled watermark into the image's actual pixel data on every serve (via `jimp`, no native image-library dependency), so a leaked copy of the raw file itself carries the watermark rather than a strippable DOM overlay. Web UI adds a profile-photo upload/preview.
