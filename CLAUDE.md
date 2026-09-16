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

## Known backlog overlap: #41 and #142

Issue #142 ("Report misconduct directly from the chat screen") is an exact duplicate of already-merged #41 ("User reporting system") in the auto-generated backlog — same feature, same reference app (Bumble), same acceptance criteria, with no differentiating angle like #46/#47 had (that pair had genuinely different scopes to build; this pair doesn't). #41 already shipped exactly what #142 asks for: a per-message "Report" button in `ChatRoom.tsx` (see `ReportDialog`), categorized report reasons, and the dependency-free `ReportStore` (`apps/api/src/reports.ts`) behind `POST /api/reports`. No separate implementation was made for #142 — skip it in `/next-issue` picks (see that file's step 1) rather than rebuilding the same feature, and close it as a duplicate of #41 once confirmed.

## Known backlog overlap: #146 and #147

Issue #146 ("Send invitations for real dates within the chat") and #147 ("Share a date proposal (suggest cinema, cafe, restaurant)") are adjacent in the auto-generated backlog and both touch "planning a real date in chat," but they're genuinely different in scope, not a duplicate pair like #46/#47 or #41/#142: #146 is a formal invitation with a specific location, date/time, and an accept/decline RSVP (`dateInvites.ts`'s `DateInvite`, rendered as a `DateInviteCard`). #147 is a lightweight, no-commitment quick-reply chip suggesting a category of activity (cinema/cafe/restaurant/park/drinks, `dateProposals.ts`'s fixed catalog) with no location, no time, and no RSVP — closer to #132's Icebreaker suggestions than to #146's formal invite. Both are implemented and kept as separate features; no reconciliation needed.

## Known backlog overlap: #5 and #152

Issue #152 ("Push notification for a new text message") is an exact duplicate of already-implemented #5 ("Web Push notifications") in the auto-generated backlog — same feature, no differentiating angle. #5 already shipped this: `message:send` calls `pushService.notifyOthers(message.author, { title: message.author, body: message.text })` for every new chat message, delivered via the VAPID-backed subscribe/notify flow and the service worker's `push` handler. No separate implementation was made for #152 — skip it in `/next-issue` picks (see that file's step 1) and close it as a duplicate of #5 once confirmed.

## Known backlog overlap: #60 and #162

Issue #162 ("Manage connected and active devices") is an exact duplicate of already-implemented #60 ("Log active sessions with the ability to log out of other devices") in the auto-generated backlog — same feature (Tinder/Bumble's real active-sessions device manager), no differentiating angle. #60 already shipped this: `TokenService` (`apps/api/src/auth.ts`) tracks one session per sign-in with a friendly device label, `GET /api/auth/sessions` lists them marking the caller's own, `DELETE /api/auth/sessions/:sessionId` logs out one device, `DELETE /api/auth/sessions/others` logs out every device but the current one, and `/settings/sessions` is the UI. No separate implementation was made for #162 — skip it in `/next-issue` picks (see that file's step 1) and close it as a duplicate of #60 once confirmed.

## Known backlog overlap: #160 and #165

Issue #165 ("Set custom ringtones and alerts for the app") is an exact duplicate of already-implemented #160 ("Custom ringtone and vibration for app notifications") in the auto-generated backlog — same feature, no differentiating angle. #160 already shipped this: `NotificationSoundStore` (`apps/api/src/notificationSound.ts`) covers a real synthesized-in-browser ringtone (foreground only, since the Push API has no cross-browser custom-sound option) plus a real background vibration pattern, with `/settings/notification-sound` as the UI — "alerts" in #165's title doesn't add anything beyond what #160's ringtone+vibration pair and #156's per-category notification preferences (`/settings/notifications`) already cover. No separate implementation was made for #165 — skip it in `/next-issue` picks (see that file's step 1) and close it as a duplicate of #160 once confirmed.

## Known backlog overlap: #9 and #168

Issue #168 ("Quickly change the app language") is an exact duplicate of already-implemented #9 ("Multilingual (i18n) and RTL/LTR support") in the auto-generated backlog — same feature, no differentiating angle. #9 already shipped exactly this: `LocaleToggle` (`apps/web/src/app/LocaleProvider.tsx`) is a one-tap dropdown always visible in the chat header, switching language instantly (flips `lang`/`dir` on `<html>`, persists to `localStorage`) — as "quick" as a language switcher gets. No separate implementation was made for #168 — skip it in `/next-issue` picks (see that file's step 1) and close it as a duplicate of #9 once confirmed.

## Known backlog overlap: #84 and #269

Issue #269 ("Ability to set 'I'm traveling' mode") is an exact duplicate of already-implemented #84 ("Show work/travel mode") in the auto-generated backlog — same feature, same reference framing, no differentiating angle (unlike #102's Passport mode, which is a genuinely different, functional location-override feature, not a cosmetic badge). #84 already shipped this: `TravelModeInfoStore` (`PUT`/`GET /api/travel-mode-info/:author`) is a real "I'm temporarily somewhere else" toggle plus an optional destination string. No separate implementation was made for #269 — skip it in `/next-issue` picks (see that file's step 1) and close it as a duplicate of #84 once confirmed.

## Known backlog overlap: #96 and #276

Issue #276 ("Filter by exact height in centimeters") is an exact duplicate of already-implemented #96 ("Advanced filter by height, education and language") in the auto-generated backlog — same feature, no differentiating angle. #96 already shipped this: `DiscoveryFiltersStore` (`discoveryFilters.ts`) lets each author set a real `minHeightCm`/`maxHeightCm` range (stored and filtered in exact centimeters, not some other unit), enforced by `candidateMatchesFilters()` against `/api/swipe-candidates/:author`, edited via `DiscoveryFiltersEditor` on `/settings/profile` — "exact" doesn't add anything a min=max range doesn't already express. No separate implementation was made for #276 — skip it in `/next-issue` picks (see that file's step 1) and close it as a duplicate of #96 once confirmed.

## Known backlog overlap: #228 and #282

Issue #282 ("Ability to create a group to organize events") is an exact duplicate of already-implemented #228 ("Ability to form interest groups (e.g., a hiking group)") in the auto-generated backlog — same feature (a persistent, joinable group whose members organize real-world/online activities), same reference app (Match.com), no differentiating angle. #228 already shipped exactly this: `InterestGroupStore` (`apps/api/src/interestGroups.ts`) lets any author create a named group, others join/leave it, and members-only organize a capacity-limited, waitlisted `GroupActivity` scoped to that group — the "create a group to organize events" #282 describes. No separate implementation was made for #282 — skip it in `/next-issue` picks (see that file's step 1) and close it as a duplicate of #228 once confirmed.

## Known backlog overlap: #254 and #283

Issue #283 ("Show a 'quick responder' badge on the profile") is an exact duplicate of already-implemented #254 ("System showing a user's message response speed") in the auto-generated backlog — same underlying feature (a positive-only profile badge derived from real reply-latency data), just framed against a different reference app (Bumble's "Fast replier" vs. Tinder's generalized response-speed system) with no differentiating angle. #254 already shipped exactly this: `computeResponseSpeed()` (`apps/api/src/responseSpeed.ts`) computes a real median reply gap from an author's own message history and labels it "fast" (badge-worthy)/"moderate"/"slow"/"unknown", and `ResponseSpeedBadge.tsx` renders only the positive "fast" case ("⚡ Usually replies within minutes") on the profile page — the doc comment even explicitly names Bumble's "Fast replier" badge as the feature being generalized. No separate implementation was made for #283 — skip it in `/next-issue` picks (see that file's step 1) and close it as a duplicate of #254 once confirmed.

## Issue workflow

Issues are tracked on GitHub (`gh issue list`) and implemented one at a time via `/next-issue` (`.claude/commands/next-issue.md`). Read that file for the exact branch/PR rules before doing any issue work — do not improvise a different workflow.
