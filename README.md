# ChatApp

A dating app built around real-time chat, built incrementally from the project's 500-feature issue backlog, one issue at a time via the `/next-issue` workflow. See `CLAUDE.md` for the product-direction note.

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
- #39 Onboarding draft persistence — a stable draft id generated once and remembered in localStorage, so `/onboarding` resumes progress without needing a bookmarked `?userId=` URL after a crash or closed tab
