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
- Biometric re-authentication when entering the app (#49): WebAuthn platform authenticators (Touch ID/Windows Hello/Android fingerprint via Chrome) are the real, working web equivalent of native biometric re-auth — `WebAuthnStore` (`apps/api/src/webauthn.ts`, `@simplewebauthn/server`) enrolls a `platform`-attachment, `userVerification: "required"` credential per guest identity and re-verifies it whenever the tab becomes visible again. A persistent guest identity (`localStorage`, `apps/web/src/app/guestIdentity.ts`) replaces the previous per-reload random author, since re-authentication needs something to re-authenticate *against*. `BiometricLock.tsx` gates the chat UI: first visit offers enrollment (skippable), later visits/returns require an `@simplewebauthn/browser` re-auth before revealing content.
