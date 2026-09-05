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
- Complete account and data deletion / GDPR erasure (#50): `DELETE /api/account/:author` erases every message an author has sent. `AccountDeletionCoordinator` (`apps/api/src/accountDeletion.ts`) is a registry, not a single hardcoded purge, so future safety-feature stores (blocks, safety plans, SOS contacts, WebAuthn credentials, photos — each currently on its own unmerged branch) can register their own purge callback once merged. Web UI: `/privacy` requires typing "DELETE" to confirm before erasing, consistent with Feeld's minimal-but-safety-conscious pattern.
