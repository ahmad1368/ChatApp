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
- Emergency SOS (#48): a prominent SOS button in the chat UI uses the browser's real, working Geolocation API to capture the sender's current position and trigger an alert (`SOSStore`, `apps/api/src/sos.ts`) that's shared with every registered emergency contact via a distinct, live-updating share code each (stubbed notification delivery, same pattern as other stubbed third-party sends). The sender can push location updates while the alert is active and resolve it once safe; contacts view a live, auto-refreshing `/sos/shared/[code]` page with no login required.
