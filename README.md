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
- Share My Date (#47): richer trusted-contact date-sharing than #46's static plan — `SharedDateStore` (`apps/api/src/sharedDates.ts`) issues a distinct share code per named trusted contact (`POST /api/shared-dates`), lets the sharer push live status updates (`PATCH /api/shared-dates/:id/status`: planned/on the way/arrived/safe/need help) that every contact sees on refresh, and supports revoking all access at once (`POST /api/shared-dates/:id/revoke`). `/share-my-date` is the sharer's UI; `/share-my-date/shared/[code]` is the trusted contact's auto-refreshing read-only view. Note: this overlaps with #46's simpler "Share your date" — see CLAUDE.md's "Known backlog overlap" section for the reconciliation plan once both merge.
