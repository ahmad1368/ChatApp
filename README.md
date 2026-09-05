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
- Safety Center and guide for safe meetups (#46): `/safety` page with static safe-meetup tips plus "Share your date" — `SafetyPlanStore` (`apps/api/src/safetyPlans.ts`) records who/where/when and issues a share code (`POST /api/safety/plans`); a trusted contact opens `/safety/shared/:code` (`GET /api/safety/plans/shared/:shareCode`) to view the plan read-only, no login required, matching the Bumble/Tinder "share my date" pattern. Report/Block deep-links into the Safety Center are deferred until #41/#42 merge into this app's baseline.
