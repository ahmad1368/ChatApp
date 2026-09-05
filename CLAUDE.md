# ChatApp

## Stack

- Monorepo via npm workspaces: `apps/web` (Next.js + TS), `apps/api` (Express + Socket.io), `packages/shared` (shared types).
- No mobile app (React Native/Expo) exists in this repo. The issue backlog was auto-generated with a "Android/iOS/Web" acceptance checklist assuming a full native mobile stack; this project scopes that down to **web-first**. When an issue's acceptance criteria mention mobile platforms, implement the web/PWA equivalent and note the mobile scope as deferred in the PR description rather than skipping the issue or building native apps. Revisit this scoping decision if the user asks for native mobile.
- Real-time transport is Socket.io end-to-end (not a separate push service) unless an issue specifically requires native/web push (e.g. Web Push API, FCM).

## Issue workflow

Issues are tracked on GitHub (`gh issue list`) and implemented one at a time via `/next-issue` (`.claude/commands/next-issue.md`). Read that file for the exact branch/PR rules before doing any issue work — do not improvise a different workflow.
