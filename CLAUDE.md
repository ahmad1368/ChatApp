# ChatApp

## Product direction

ChatApp is pivoting from a generic real-time chat app into a **dating app** — the 500-issue backlog (`gh issue list`) was generated against dating-app reference products (Tinder, eHarmony, Raya, Feeld, etc.) and issues from #29 onward are genuinely about dating/matching functionality (dating goals, swipe-to-match, compatibility, discovery, profiles), not generic chat infra. Build these as real dating-app features on top of the existing chat/auth/onboarding core, rather than skipping them or forcing a generic-chat reinterpretation. Issues #1-28 (cross-platform infra, auth) remain valid as-is — they're foundational to any app, dating or not. Revisit this direction if the user says otherwise.

## Stack

- Monorepo via npm workspaces: `apps/web` (Next.js + TS), `apps/api` (Express + Socket.io), `packages/shared` (shared types).
- No mobile app (React Native/Expo) exists in this repo. The issue backlog was auto-generated with a "Android/iOS/Web" acceptance checklist assuming a full native mobile stack; this project scopes that down to **web-first**. When an issue's acceptance criteria mention mobile platforms, implement the web/PWA equivalent and note the mobile scope as deferred in the PR description rather than skipping the issue or building native apps. Revisit this scoping decision if the user asks for native mobile.
- Real-time transport is Socket.io end-to-end (not a separate push service) unless an issue specifically requires native/web push (e.g. Web Push API, FCM).

## Product direction

ChatApp is pivoting from a generic real-time chat app into a **dating app** — the 500-issue backlog (`gh issue list`) was generated against dating-app reference products (Tinder, eHarmony, Raya, Feeld, OkCupid, Bumble, etc.) and issues from #29 onward are genuinely about dating/matching functionality (dating goals, gender/orientation, swipe-to-match, compatibility, discovery, profiles, safety), not generic chat infra. Build these as real dating-app features on top of the existing chat/auth/onboarding core, rather than skipping them or forcing a generic-chat reinterpretation. Issues #1-28 (cross-platform infra, auth) remain valid as-is — they're foundational to any app, dating or not. Revisit this direction if the user says otherwise.

## Known backlog overlap: #46 and #47

Issue #46 ("Safety Center and guide for safe meetups") and #47 ("Share My Date") are near-duplicates in the auto-generated backlog — both describe Bumble's "Share My Date" feature. #46 was implemented with a single-link, one-shot version (`SafetyPlanStore`). #47 was implemented as a richer, meaningfully different version (`SharedDateStore`: multiple named trusted contacts each with their own share code, a live status the sharer can push, and revocation) rather than a duplicate rebuild. When both PRs merge into `staging`, reconcile by keeping #47's `SharedDateStore` as the canonical "Share My Date" implementation and either removing #46's `SafetyPlanStore` or wiring the Safety Center's UI to call into `SharedDateStore` instead.

## Issue workflow

Issues are tracked on GitHub (`gh issue list`) and implemented one at a time via `/next-issue` (`.claude/commands/next-issue.md`). Read that file for the exact branch/PR rules before doing any issue work — do not improvise a different workflow.
