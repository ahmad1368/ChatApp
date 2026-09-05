# ChatApp

## Product direction

ChatApp is pivoting from a generic real-time chat app into a **dating app** — the 500-issue backlog (`gh issue list`) was generated against dating-app reference products (Tinder, eHarmony, Raya, Feeld, OkCupid, Bumble, etc.) and issues from #29 onward are genuinely about dating/matching functionality (dating goals, gender/orientation, swipe-to-match, compatibility, discovery, profiles, safety), not generic chat infra. Build these as real dating-app features on top of the existing chat/auth/onboarding core, rather than skipping them or forcing a generic-chat reinterpretation. Issues #1-28 (cross-platform infra, auth) remain valid as-is — they're foundational to any app, dating or not. Revisit this direction if the user says otherwise.

## Stack

- Monorepo via npm workspaces: `apps/web` (Next.js + TS), `apps/api` (Express + Socket.io), `packages/shared` (shared types).
- No mobile app (React Native/Expo) exists in this repo. The issue backlog was auto-generated with a "Android/iOS/Web" acceptance checklist assuming a full native mobile stack; this project scopes that down to **web-first**. When an issue's acceptance criteria mention mobile platforms, implement the web/PWA equivalent and note the mobile scope as deferred in the PR description rather than skipping the issue or building native apps. Revisit this scoping decision if the user asks for native mobile.
- Real-time transport is Socket.io end-to-end (not a separate push service) unless an issue specifically requires native/web push (e.g. Web Push API, FCM).

## Issue workflow

Issues are tracked on GitHub (`gh issue list`) and implemented one at a time via `/next-issue` (`.claude/commands/next-issue.md`). Read that file for the exact branch/PR rules before doing any issue work — do not improvise a different workflow.
