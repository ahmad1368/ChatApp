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
- #2 Real-time sync between mobile and web — reconnect/catch-up sync (`since` query param) so clients recover missed messages after a dropped connection, plus a live sync-status indicator
- #3 Responsive design for tablet and desktop — CSS custom properties + media-query breakpoints replace fixed inline layout
- #4 Local push-style notifications — Notification API alerts for new messages while the tab is backgrounded (foreground/open-tab equivalent of mobile push; full Web Push tracked separately in #5)
- #5 Web Push notifications — VAPID-backed subscribe/notify flow (service worker `push` handler, `/api/push/*` endpoints) so new messages can be delivered even when the tab is fully closed
- #6 Offline-first mode and data cache management — localStorage message cache for instant load, plus an outgoing-message queue that flushes automatically on reconnect
- #7 Battery and data usage optimization — WebSocket-only transport, tuned reconnection backoff, Data Saver opt-in, and auto-disconnect after the tab is hidden for 2 minutes
- #8 Dark / Light Mode support — CSS custom-property theme tokens, system-preference default, and a manual override toggle persisted in localStorage
- #9 Multilingual (i18n) and RTL/LTR support — English/Persian translations with a language switcher that flips `lang`/`dir` on `<html>` (RTL for Persian)
- #10 Deep linking — `/room/[roomId]` routing plus `?m=<messageId>` links that scroll to and highlight a specific message, with a per-message "copy link" action
- #11 Optimized REST API — backward-compatible cursor pagination (`limit`/`before`) on the messages endpoint, with a "Load older messages" client flow, instead of always shipping full room history
- #12 Image sharing with automatic compression — client-side canvas downscale/re-encode before upload, in-memory upload store, images rendered inline in the chat
- #13 CDN readiness for static assets — `NEXT_PUBLIC_CDN_URL`-driven `assetPrefix` plus immutable cache headers (build output and uploaded images), so a CDN can front the app without code changes
- #14 OS shortcuts integration — web app manifest `shortcuts` entry so installed PWAs get a jump-list/long-press shortcut into the app
- #15 Smooth 60fps swipe-to-reply — Pointer Events + transform/rAF-only dragging on message bubbles, swipe right to quote-reply
- #16 Keyboard shortcuts — Ctrl/Cmd+K to focus the composer, Shift+Enter for a new line, Esc to dismiss, and `?` for a shortcuts help overlay
- #17 Automatic crash/error reporting — global error/rejection handlers plus a React error boundary report to `/api/error-reports`, the web equivalent of Crashlytics
- #18 In-app update system — service worker update detection with an "Update now" prompt, the web equivalent of the Play Store in-app update flow
- #19 Data Saver Mode — a persistent, user-controlled toggle (defaulting to the OS Data Saver signal) that holds off loading messages/opening the live connection until the user asks for it
- #20 High-concurrency architecture readiness — optional Redis adapter for multi-instance Socket.io broadcasts, per-socket message rate limiting, and graceful shutdown
- #21 Phone number + OTP signup — `/signup` two-step flow, backend OTP request/verify with expiry/attempt limits/resend cooldown, JWT access + rotating refresh tokens
- #22 Google Sign-In — server-side ID token verification (`google-auth-library`), JWT session issuance, and a Google Identity Services button that gracefully degrades when unconfigured
- #23 Sign in with Apple — server-side ID token verification against Apple's JWKS, JWT session issuance, and a Sign in with Apple button that gracefully degrades when unconfigured
- #24 Sign in with Facebook — server-side access token verification via the Graph API's `debug_token`, JWT session issuance, gracefully-degrading button
- #25 Account recovery via email — `/recover` two-step flow reinterpreting "password recovery" for this passwordless app (SMS recovery is already covered by #21's phone OTP)
- #26 Two-factor authentication — TOTP (RFC 6238) setup with QR enrollment, confirm, verify, and disable, fully self-contained (no third-party 2FA provider needed); management endpoints gated behind a verified access token, demo UI at `/settings/security`
- #27 Biometric login (Face ID / fingerprint) via WebAuthn — real platform-authenticator registration and sign-in (no biometric data ever reaches the server, by design of the standard); registration gated behind a verified access token, login identifies the account via a device-remembered userId, demo UI at `/settings/security`
- #28 Step-by-step profile onboarding — server-persisted, resumable state machine (display name → avatar → bio) gated behind a verified access token, with a progress-bar UI at `/onboarding`
- #29 Dating goal selection — extends #28's onboarding state machine with a fourth step (marriage / friendship / casual chat), eHarmony-style choice cards; first feature of the app's dating-app pivot
- #30 Gender identity selection — extends the onboarding state machine with a fifth step offering diverse options (OkCupid-style) plus a custom free-text option and "prefer not to say"
- #31 Sexual orientation and match preferences — sixth onboarding step (diverse orientation options + who to be matched with), reusing the gender-options list for preferences
- #32 Preferred age range — seventh onboarding step, dual range sliders (18-99) validated against the legal minimum
- #33 Search radius — eighth onboarding step, distance slider plus opt-in browser geolocation with coordinates rounded server-side to ~1.1km precision before storage
- #34 Avatar upload and crop — replaces the onboarding avatar step's URL paste with a real upload + drag/zoom circular crop, backed by the existing #12 upload store
- #35 Automatic face detection in the main photo — on-device MediaPipe face detection during avatar crop, with a soft "use anyway" warning rather than a hard block
- #36 Live selfie verification — ninth onboarding step: live camera capture (never a picked file) + on-device face-presence check, stored privately with only a boolean "verified" flag ever exposed to clients, gated behind a verified access token
- #37 Verified badge — `GET /api/users/:userId/badge` (boolean-only, no image exposure, intentionally public/unauthenticated) plus a reusable blue-checkmark `VerifiedBadge` component shown after selfie verification
- #38 Guest mode with limited access — an entry choice screen (sign up vs. continue as guest, skipped entirely for an already-signed-in user); guests can read the chat but sending is disabled client-side and rejected server-side
- #39 Onboarding draft persistence across a sudden exit — `/onboarding` retries once with a refreshed access token (`fetchWithAuth`) instead of failing when a closed-tab-overnight return finds a stale 15-minute access token; the server already persists per-step progress against the real account (#28), so surviving a sudden exit only needed the session itself to survive one
- #40 Community Guidelines acceptance — new first onboarding step (ahead of display name), mandatory checkbox gate (no skip) recording an accepted-version number for future re-consent
- #41 User reporting system — categorized report reasons, a dependency-free `ReportStore` with its own rate limiting, a per-message "Report" action, and no read endpoint exposing stored reports
- #42 Block users to prevent re-encountering them — mutual, high-priority block/unblock API independent of any matching/discovery service, self-lookup only (no endpoint reveals who has blocked a given user); blocked pairs stop seeing each other's messages both in history (server-filtered) and live (client-filtered, since this app broadcasts to the whole room rather than per-socket to stay compatible with #20's Redis-backed multi-instance delivery)
- #43 Block phone contacts — users can self-declare a phone number (stored only as a SHA-256 hash, never in plaintext) and upload a contact list to auto-block any other author whose registered phone matches, reusing #42's mutual `BlockStore`; the web UI uses the Contact Picker API where supported (Chrome for Android) and falls back to manual number entry elsewhere (desktop/iOS have no bulk contact-export API)
- #44 Screenshot/DRM policy — browsers have no API to block or even detect an OS-level screenshot (no web equivalent of Android `FLAG_SECURE`/iOS screen-capture protection), so this implements the honest web mitigation: deterrence + traceability. `POST /api/watermark/session` issues a per-viewing-session trace code (never exposed via a read endpoint); the client renders it as a faint tiled watermark over the chat, and blurs chat content on tab-blur/visibility-change as defense-in-depth against shoulder-surfing/screen-share leaks
- #45 Custom photo watermarking to prevent photo theft — `PhotoStore` (5MB cap, jpeg/png/webp) + `POST /api/photos` upload; `GET /api/photos/:id` dynamically burns a viewer-labeled watermark into the image's actual pixel data on every serve (via `jimp`, no native image-library dependency), so a leaked copy of the raw file itself carries the watermark rather than a strippable DOM overlay
- #46 Safety Center and guide for safe meetups — `/safety` page with static safe-meetup tips; its "Share your date" section now links to #47's `/share-my-date` flow (reconciled per CLAUDE.md's known-overlap note — #46's original single-link `SafetyPlanStore` is retired in favor of #47's richer `SharedDateStore`)
- #47 Share My Date — canonical "share your date" implementation: `SharedDateStore` issues a distinct share code per named trusted contact (`POST /api/shared-dates`), lets the sharer push live status updates (`PATCH /api/shared-dates/:id/status`: planned/on the way/arrived/safe/need help) that every contact sees on refresh, and supports revoking all access at once (`POST /api/shared-dates/:id/revoke`); `/share-my-date` is the sharer's UI, `/share-my-date/shared/[code]` is the trusted contact's read-only view
- #48 Emergency SOS — a prominent SOS button in the chat UI uses the browser's Geolocation API to capture the sender's current position and trigger an alert (`SOSStore`) shared with every registered emergency contact via a distinct, live-updating share code each (stubbed notification delivery, same pattern as other stubbed third-party sends); the sender can push location updates while the alert is active and resolve it once safe, and contacts view a live, auto-refreshing `/sos/shared/[code]` page with no login required
- #49 Biometric re-authentication when entering the app — WebAuthn platform authenticators (Touch ID/Windows Hello/Android fingerprint via Chrome) are the real, working web equivalent of native biometric re-auth; `WebAuthnStore` (`apps/api/src/webauthn.ts`, `@simplewebauthn/server`) enrolls a `platform`-attachment, `userVerification: "required"` credential per guest identity and re-verifies it whenever the tab becomes visible again. A persistent guest identity (`localStorage`, `apps/web/src/app/guestIdentity.ts`) replaces the previous per-reload random author, since re-authentication needs something to re-authenticate *against*. `BiometricLock.tsx` gates the chat UI: first visit offers enrollment (skippable), later visits/returns require an `@simplewebauthn/browser` re-auth before revealing content
- Complete account and data deletion (GDPR erasure) — `DELETE /api/account/:author`, web page at `/privacy`
- Download a backup of personal data (GDPR export) — `GET /api/account/:author/export`, web download page at `/privacy/export`
- Hide exact location and show only an approximation (~5km) — `PUT`/`GET /api/users/:author/location`, web page at `/privacy/location`
- Full PWA support for the browser — web app manifest, installable icons, and an offline-capable service worker with an offline fallback page
- #53 Detect duplicate/intrusive accounts based on IP and device fingerprint — `DuplicateAccountStore` links accounts that share a hashed IP address or a client-declared device fingerprint (never the raw values), flagging both sides for review rather than blocking sign-in outright (too many false positives from shared wifi/VPNs to act on automatically); wired into every sign-in path (phone OTP, Google, Apple, Facebook) via `GET /api/auth/duplicate-status`, surfaced to the affected user themselves as a heads-up on `/settings/security`
- #54 Don't show profile to people from the same city/workplace (if configured) — Bumble's real "hide my profile from members of my workplace/school" preference, generalized to a self-reported city too; `DiscoveryVisibilityStore` (`PUT`/`GET /api/discovery-visibility`, gated behind a verified access token) stores the opt-in toggle and the pure visibility check a future discovery/matching feature will call — this app has no discovery feed yet, so this stores the preference ahead of that, the same scoping already used for #33's search radius; settings UI at `/settings/discovery-visibility`
- #55 Automatically scan profile text to prevent sharing a phone number or address — `scanForContactInfo()` (`apps/api/src/contactInfoDetector.ts`) heuristically detects phone numbers (digit runs of 7+, with or without separators) and street addresses (a house number plus a street-type word) in free text; wired into onboarding's `displayName` and `bio` steps, which now reject saving with an editable error rather than silently stripping anything
- #56 Strict policy against financial and crypto scams — `scanForScamContent()` (`apps/api/src/scamDetector.ts`) detects crypto wallet addresses (Bitcoin legacy/bech32, Ethereum) and common investment-scam phrasing in chat messages; the `message:send` socket handler now rejects a flagged message (`message:rejected` with reason `scam_content`) the same way it already rejects a rate-limited or guest-mode send, and the client surfaces a plain-language explanation instead of the message silently vanishing
- #57 Automatic bot detection and blocking (reCAPTCHA) — `RecaptchaService` (`apps/api/src/recaptcha.ts`) verifies a reCAPTCHA v3 token against Google's siteverify endpoint (score-threshold check, same injectable-verifier pattern as #22-#24's OAuth providers) and gates `POST /api/auth/signup/request-otp`, the one signup step that costs real money to abuse; gracefully degrades to a no-op when `RECAPTCHA_SECRET_KEY`/`NEXT_PUBLIC_RECAPTCHA_SITE_KEY` aren't configured, so phone-OTP signup — this app's only always-available sign-in method — never breaks because of it
- #58 Report spam or promotional messages to the monitoring system — `scanForSpamContent()` (`apps/api/src/spamDetector.ts`) detects links and common promotional phrasing in chat messages; unlike #56's scam check, a match doesn't block the send (Tinder's real behavior is to route it to moderation, not break the conversation over a promotional link) — instead it auto-files a `spam`-reason report into #41's existing `ReportStore`, the "monitoring system" already in this codebase
