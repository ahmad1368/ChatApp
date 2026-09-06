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
- Complete account and data deletion (GDPR erasure) — `DELETE /api/account/:author`, web page at `/privacy`
- Download a backup of personal data (GDPR export) — `GET /api/account/:author/export`, web download page at `/privacy/export`
- Hide exact location and show only an approximation (~5km) — `PUT`/`GET /api/users/:author/location`, web page at `/privacy/location`
