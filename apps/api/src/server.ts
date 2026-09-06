import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, ONBOARDING_STEPS, OnboardingStep, SendMessagePayload } from "@chatapp/shared";
import { normalizePhoneNumber, OtpService, TokenService, UserStore } from "./auth";
import { TwoFactorService } from "./twoFactor";
import { WebAuthnService, WebAuthnStore } from "./webauthn";
import { OnboardingStore } from "./onboarding";
import { GoogleAuthService } from "./googleAuth";
import { AppleAuthService } from "./appleAuth";
import { FacebookAuthService } from "./facebookAuth";
import { normalizeEmail, RecoveryCodeService } from "./recovery";
import { RateLimiter } from "./rateLimiter";
import { createRedisAdapterIfConfigured } from "./redisAdapter";
import { ErrorReportStore } from "./errorReports";
import { buildChatMessage } from "./messages";
import { exportDataForAuthor } from "./dataExport";
import { AccountDeletionCoordinator, deleteMessagesForAuthor } from "./accountDeletion";
import { isValidCoordinates, LocationStore } from "./locationPrivacy";
import { PushService } from "./push";
import { UploadStore } from "./uploads";
import { VerificationStore } from "./verification";
import { isGuestSendAllowed } from "./guestMode";
import { ReportStore } from "./reports";
import { BlockStore } from "./blocks";
import { ContactBlockStore } from "./contactBlocks";
import { WatermarkStore } from "./watermark";
import { PhotoStore } from "./photos";
import { SharedDateStore } from "./sharedDates";
import { SOSStore } from "./sos";
import { applyWatermark } from "./watermarkImage";
import { DuplicateAccountStore } from "./duplicateAccounts";
import { DiscoveryVisibilityStore } from "./discoveryVisibility";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MESSAGE_RATE_LIMIT = 20;
const MESSAGE_RATE_WINDOW_MS = 10_000;

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function createApp(deps?: {
  googleAuthService?: GoogleAuthService;
  appleAuthService?: AppleAuthService;
  facebookAuthService?: FacebookAuthService;
}): {
  app: Express;
  messagesByRoom: Map<string, ChatMessage[]>;
  pushService: PushService;
  errorReportStore: ErrorReportStore;
  otpService: OtpService;
  recoveryCodeService: RecoveryCodeService;
  twoFactorService: TwoFactorService;
  webAuthnService: WebAuthnService;
  onboardingStore: OnboardingStore;
  verificationStore: VerificationStore;
  reportStore: ReportStore;
  blockStore: BlockStore;
  contactBlockStore: ContactBlockStore;
  watermarkStore: WatermarkStore;
  photoStore: PhotoStore;
  sharedDateStore: SharedDateStore;
  sosStore: SOSStore;
  webAuthnStore: WebAuthnStore;
  duplicateAccountStore: DuplicateAccountStore;
  discoveryVisibilityStore: DiscoveryVisibilityStore;
} {
  const app = express();
  // Custom response headers aren't visible to browser fetch() by default —
  // must be explicitly exposed via CORS for the client to read X-Has-More.
  app.use(cors({ exposedHeaders: ["X-Has-More"] }));
  // Base64-encoded images are ~33% larger than their binary size, so allow
  // a generous body limit even though individual images are capped in
  // UploadStore after decoding.
  app.use(express.json({ limit: "10mb" }));

  const messagesByRoom = new Map<string, ChatMessage[]>();
  const locations = new LocationStore();
  const pushService = new PushService();
  const uploadStore = new UploadStore();
  const errorReportStore = new ErrorReportStore();
  const otpService = new OtpService();
  const recoveryCodeService = new RecoveryCodeService();
  const userStore = new UserStore();
  const tokenService = new TokenService();
  const twoFactorService = new TwoFactorService();
  const webAuthnService = new WebAuthnService({
    rpId: process.env.WEBAUTHN_RP_ID ?? "localhost",
    origin: process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000",
  });
  const verificationStore = new VerificationStore();
  const onboardingStore = new OnboardingStore(verificationStore);
  const reportStore = new ReportStore();
  const blockStore = new BlockStore();
  const contactBlockStore = new ContactBlockStore();
  const watermarkStore = new WatermarkStore();
  const photoStore = new PhotoStore();
  const sharedDateStore = new SharedDateStore();
  const sosStore = new SOSStore();
  // Distinct from webAuthnService above: that one re-authenticates a real
  // account (userId, from #21-#25 sign-in) for login; this one re-
  // authenticates the ephemeral chat `author` identity for the app-lock
  // screen below, matching the rest of chat's un-unified author-keyed
  // safety stores (Report/Block/SOS).
  const webAuthnStore = new WebAuthnStore();
  const duplicateAccountStore = new DuplicateAccountStore();
  const discoveryVisibilityStore = new DiscoveryVisibilityStore();
  // Injectable so tests can exercise real branching logic (configured vs.
  // not, valid vs. invalid token) without a real Google Cloud project.
  const googleAuthService = deps?.googleAuthService ?? new GoogleAuthService();
  const appleAuthService = deps?.appleAuthService ?? new AppleAuthService();
  const facebookAuthService = deps?.facebookAuthService ?? new FacebookAuthService();

  const accountDeletion = new AccountDeletionCoordinator();
  accountDeletion.register((author) => deleteMessagesForAuthor(messagesByRoom, author));

  // Verifies the caller's access token (issued by any of the #21-#25 sign-in
  // methods) and derives userId from it, rather than trusting a client-
  // supplied value — used to gate the 2FA management endpoints below.
  function requireAuth(req: express.Request, res: express.Response): string | undefined {
    const header = req.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    const verified = token ? tokenService.verifyAccessToken(token) : undefined;
    if (!verified) {
      res.status(401).json({ error: "A valid Authorization: Bearer <accessToken> header is required" });
      return undefined;
    }
    return verified.userId;
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Safety-critical action: kept as its own tiny route with no dependency
  // on the chat/upload/onboarding subsystems, per the issue's
  // implementation guide ("no dependency on heavier services"). No GET
  // endpoint exposes stored reports — they contain claims about other
  // users and aren't safe to serve without real moderator auth.
  // reporterAuthor is self-reported like every other chat `author` in
  // this codebase (see ChatRoom.tsx) rather than derived from requireAuth:
  // chat identity and the #21-#25 account system aren't wired together
  // yet, so gating this alone wouldn't actually verify anything the rest
  // of chat doesn't already trust.
  app.post("/api/reports", (req, res) => {
    const reporterAuthor = typeof req.body?.reporterAuthor === "string" ? req.body.reporterAuthor : "";
    const result = reportStore.submit(reporterAuthor, req.body ?? {});
    if (!result.success) {
      const status = result.error.startsWith("Too many") ? 429 : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    res.status(201).json({ id: result.report.id });
  });

  // Blocking is a safety-critical, high-priority path kept independent of
  // any heavier service (matching, discovery, etc.) so it always works.
  app.post("/api/blocks", (req, res) => {
    const result = blockStore.block(req.body?.blockerAuthor, req.body?.blockedAuthor);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.record);
  });

  app.delete("/api/blocks", (req, res) => {
    const removed = blockStore.unblock(req.body?.blockerAuthor, req.body?.blockedAuthor);
    if (!removed) {
      res.status(404).json({ error: "Block not found" });
      return;
    }
    res.status(204).send();
  });

  // Self-lookup only: returns the authors *this* blocker has blocked, never
  // who has blocked a given author (that would leak block state to the
  // blocked party).
  app.get("/api/blocks/:blockerAuthor", (req, res) => {
    res.json({ blockedAuthors: blockStore.getBlockedAuthors(req.params.blockerAuthor) });
  });

  // Self-declared phone number (same client-supplied-identity limitation as
  // every other author-scoped endpoint, pending real auth). Stored only as
  // a hash — see the privacy note in contactBlocks.ts.
  app.post("/api/profile/phone", (req, res) => {
    const result = contactBlockStore.registerPhone(req.body?.author, req.body?.phoneNumber);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(204).send();
  });

  // "Block phone contacts": given the caller's phone contact list, find any
  // registered author whose phone matches a contact and block them via the
  // same BlockStore a manual block would use (message filtering just works).
  app.post("/api/contacts/block", (req, res) => {
    const author = typeof req.body?.author === "string" ? req.body.author.trim() : "";
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    const matches = contactBlockStore.findMatchingAuthors(author, req.body?.phoneNumbers);
    const blockedAuthors = matches.filter((matched) => blockStore.block(author, matched).success);
    res.status(200).json({ blockedAuthors });
  });

  // DRM/screenshot policy: browsers have no API to block or detect an
  // OS-level screenshot, so this is a high-priority, dependency-free
  // deterrence path — issue a per-viewing-session trace code the client
  // stamps into an on-screen watermark, so a leaked screenshot can be
  // traced back to who viewed it.
  app.post("/api/watermark/session", (req, res) => {
    const session = watermarkStore.issueTraceCode(req.body?.author, req.body?.roomId);
    if (!session) {
      res.status(400).json({ error: "author and roomId are required" });
      return;
    }
    res.status(201).json(session);
  });

  // Photo theft deterrence: this is its own high-priority, dependency-free
  // safety path, independent of any matching/discovery service.
  app.post("/api/photos", (req, res) => {
    const result = photoStore.upload(req.body?.author, req.body?.mimeType, req.body?.data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ id: result.photo.id });
  });

  // Watermarks are burned into the pixel data dynamically on every serve
  // (never stored pre-watermarked), so they survive any copy of the bytes —
  // a download, a re-upload, a screenshot of the raw file — not just a DOM
  // overlay a determined thief could strip before saving.
  app.get("/api/photos/:id", async (req, res) => {
    const photo = photoStore.get(req.params.id);
    if (!photo) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }
    const viewer = typeof req.query.viewer === "string" && req.query.viewer.trim() ? req.query.viewer.trim() : "ChatApp";
    try {
      const watermarked = await applyWatermark(photo.data, viewer);
      res.setHeader("Content-Type", "image/png");
      res.status(200).send(watermarked);
    } catch {
      res.status(500).json({ error: "Failed to render photo" });
    }
  });

  // "Share My Date": its own high-priority, dependency-free safety path,
  // same as Report/Block. Each trusted contact gets a distinct share code,
  // and the sharer can push a live status update or revoke access. This is
  // the canonical implementation for #46/#47 (near-duplicates in the
  // backlog — see CLAUDE.md); #46's original single-link SafetyPlanStore
  // has been retired in favor of this richer version.
  app.post("/api/shared-dates", (req, res) => {
    const result = sharedDateStore.create(req.body?.author, req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.date);
  });

  app.patch("/api/shared-dates/:id/status", (req, res) => {
    const result = sharedDateStore.updateStatus(req.body?.author, req.params.id, req.body?.status);
    if (!result.success) {
      const status = result.error === "Shared date not found" ? 404 : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    res.json(result.date);
  });

  app.post("/api/shared-dates/:id/revoke", (req, res) => {
    const revoked = sharedDateStore.revoke(req.body?.author, req.params.id);
    if (!revoked) {
      res.status(404).json({ error: "Shared date not found" });
      return;
    }
    res.status(204).send();
  });

  app.get("/api/shared-dates/shared/:shareCode", (req, res) => {
    const view = sharedDateStore.viewByShareCode(req.params.shareCode);
    if (!view) {
      res.status(404).json({ error: "Shared date not found" });
      return;
    }
    res.json(view);
  });

  // Emergency SOS: its own high-priority, dependency-free safety path,
  // same as Report/Block/Share My Date.
  app.post("/api/sos/contacts", (req, res) => {
    const result = sosStore.addContact(req.body?.author, req.body?.name, req.body?.contactMethod);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.contact);
  });

  app.get("/api/sos/contacts/:author", (req, res) => {
    res.json({ contacts: sosStore.listContacts(req.params.author) });
  });

  app.post("/api/sos/alerts", (req, res) => {
    const result = sosStore.triggerSOS(req.body?.author, req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.alert);
  });

  app.patch("/api/sos/alerts/:id/location", (req, res) => {
    const result = sosStore.updateLocation(req.body?.author, req.params.id, req.body);
    if (!result.success) {
      const status = result.error === "Alert not found" ? 404 : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    res.json(result.alert);
  });

  app.post("/api/sos/alerts/:id/resolve", (req, res) => {
    const resolved = sosStore.resolve(req.body?.author, req.params.id);
    if (!resolved) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.status(204).send();
  });

  app.get("/api/sos/alerts/shared/:shareCode", (req, res) => {
    const view = sosStore.viewByShareCode(req.params.shareCode);
    if (!view) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.json(view);
  });

  // Biometric re-authentication for the app-lock screen: its own high-
  // priority, dependency-free safety path, same as Report/Block/SOS above.
  // Keyed by the chat `author` identity (see webAuthnStore's note), not
  // requireAuth's userId.
  app.get("/api/webauthn/status/:author", (req, res) => {
    res.json({ registered: webAuthnStore.isRegistered(req.params.author) });
  });

  app.post("/api/webauthn/registration/options", async (req, res) => {
    const result = await webAuthnStore.createRegistrationOptions(req.body?.author);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.options);
  });

  app.post("/api/webauthn/registration/verify", async (req, res) => {
    const result = await webAuthnStore.verifyRegistration(req.body?.author, req.body?.response);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(204).send();
  });

  app.post("/api/webauthn/authentication/options", async (req, res) => {
    const result = await webAuthnStore.createAuthenticationOptions(req.body?.author);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.options);
  });

  app.post("/api/webauthn/authentication/verify", async (req, res) => {
    const result = await webAuthnStore.verifyAuthentication(req.body?.author, req.body?.response);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(204).send();
  });

  // No GET endpoint for verification selfies, deliberately — see the
  // privacy note in verification.ts. Only a boolean outcome is ever
  // returned. Gated behind requireAuth (same reasoning as onboarding
  // below) rather than a client-supplied userId in the body.
  app.post("/api/verification/selfie", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { mimeType, data } = req.body ?? {};
    if (typeof mimeType !== "string" || typeof data !== "string") {
      res.status(400).json({ error: "mimeType and data are required" });
      return;
    }
    const result = verificationStore.saveSelfie(userId, mimeType, data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ verified: true });
  });

  // Public-safe badge lookup: a stable read API for "is this user verified"
  // that any future profile-card UI can call, independent of onboarding
  // state (which represents in-progress signup, not a durable profile
  // lookup). Returns only the boolean — never the underlying selfie. Unlike
  // the onboarding/verification-submission endpoints, this is intentionally
  // NOT gated behind requireAuth: a verified badge is meant to be visible
  // to other users viewing this profile, not just its owner.
  app.get("/api/users/:userId/badge", (req, res) => {
    res.json({ verified: verificationStore.isVerified(req.params.userId) });
  });

  // Server-persisted onboarding state machine: gated behind requireAuth
  // (rather than trusting a :userId URL param, as the original branch
  // documented as a known gap before #21-#25's TokenService existed) so one
  // signed-in user can't read or overwrite another's in-progress profile.
  app.get("/api/onboarding", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    res.json(onboardingStore.getState(userId));
  });

  app.post("/api/onboarding/step", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { step, data } = req.body ?? {};
    if (!isOnboardingStep(step)) {
      res.status(400).json({ error: `step must be one of: ${ONBOARDING_STEPS.join(", ")}` });
      return;
    }
    const result = onboardingStore.submitStep(userId, step, data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.state);
  });

  // Two orthogonal, backward-compatible filters on top of the full history:
  // `since` (ISO timestamp) lets a reconnecting client fetch only the
  // messages it missed. `limit` opts into cursor pagination instead — the
  // page of `limit` messages immediately before `before` (or the most
  // recent page if omitted) — so a client only pays for what it actually
  // renders, which matters most on mobile-grade connections. `X-Has-More`
  // is a header, not a body-shape change, so existing callers expecting a
  // bare array keep working unmodified. With neither param, behaves exactly
  // as before (full history, plain array).
  app.get("/api/rooms/:roomId/messages", (req, res) => {
    const { roomId } = req.params;
    const viewer = typeof req.query.viewer === "string" ? req.query.viewer : undefined;
    const unfiltered = messagesByRoom.get(roomId) ?? [];
    // Blocking is mutual for "not re-encountering" purposes — see blocks.ts.
    // The client also filters message:new the same way, since this app has
    // no per-viewer socket delivery to filter against without breaking
    // #20's Redis-backed multi-instance broadcast.
    const all = viewer ? unfiltered.filter((m) => !blockStore.isMutuallyBlocked(viewer, m.author)) : unfiltered;

    const since = typeof req.query.since === "string" ? req.query.since : undefined;
    if (since !== undefined) {
      res.json(all.filter((m) => m.createdAt > since));
      return;
    }

    if (req.query.limit === undefined) {
      res.json(all);
      return;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const beforeId = typeof req.query.before === "string" ? req.query.before : undefined;
    const beforeIndex = beforeId ? all.findIndex((m) => m.id === beforeId) : all.length;
    const endIndex = beforeIndex === -1 ? all.length : beforeIndex;
    const startIndex = Math.max(0, endIndex - limit);

    res.set("X-Has-More", String(startIndex > 0));
    res.json(all.slice(startIndex, endIndex));
  });

  // GDPR data portability: its own high-priority, dependency-free path,
  // same as Report/Block/SOS. Streams the requester's own data back as a
  // downloadable JSON backup rather than requiring a separate export job.
  app.get("/api/account/:author/export", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    const dataExport = exportDataForAuthor(messagesByRoom, author);
    res.setHeader("Content-Disposition", `attachment; filename="chatapp-data-${encodeURIComponent(author)}.json"`);
    res.json(dataExport);
  });

  // GDPR erasure: its own high-priority, dependency-free safety path, same
  // as Report/Block/SOS. See AccountDeletionCoordinator for why this is a
  // registry rather than a single hardcoded purge.
  app.delete("/api/account/:author", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    res.json(accountDeletion.deleteAllDataFor(author));
  });

  // Location privacy: a user's exact coordinates never leave this process —
  // every read returns a coordinate snapped to a ~5km grid cell instead.
  app.put("/api/users/:author/location", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    if (!isValidCoordinates(req.body)) {
      res.status(400).json({ error: "lat/lng must be numbers within valid ranges" });
      return;
    }
    locations.setLocation(author, req.body);
    res.json({ approximate: locations.getApproximateLocation(author) });
  });

  app.get("/api/users/:author/location", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    const approximate = locations.getApproximateLocation(author);
    if (!approximate) {
      res.status(404).json({ error: "no location on file for this user" });
      return;
    }
    res.json({ approximate });
  });

  // Web Push: delivers new-message alerts even when the tab is fully closed
  // (see the Notification-API path in ChatRoom.tsx for the backgrounded-tab
  // equivalent, which doesn't need a push subscription).
  app.get("/api/push/public-key", (_req, res) => {
    res.json({ publicKey: pushService.publicKey });
  });

  app.post("/api/push/subscribe", (req, res) => {
    const { author, subscription } = req.body ?? {};
    if (!author || !subscription?.endpoint) {
      res.status(400).json({ error: "author and subscription.endpoint are required" });
      return;
    }
    pushService.subscribe(author, subscription);
    res.status(201).json({ status: "subscribed" });
  });

  app.post("/api/push/unsubscribe", (req, res) => {
    const { endpoint } = req.body ?? {};
    if (!endpoint) {
      res.status(400).json({ error: "endpoint is required" });
      return;
    }
    pushService.unsubscribe(endpoint);
    res.json({ status: "unsubscribed" });
  });

  // Image sharing: the client compresses/downscales before uploading (see
  // imageCompression.ts), so this just validates mime type and size.
  app.post("/api/uploads", (req, res) => {
    const { mimeType, data } = req.body ?? {};
    if (typeof mimeType !== "string" || typeof data !== "string") {
      res.status(400).json({ error: "mimeType and data are required" });
      return;
    }
    const result = uploadStore.save(mimeType, data);
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ url: `/api/uploads/${result.id}` });
  });

  app.get("/api/uploads/:id", (req, res) => {
    const upload = uploadStore.get(req.params.id);
    if (!upload) {
      res.status(404).end();
      return;
    }
    res.set("Content-Type", upload.mimeType);
    // Uploads are content-addressed by a random id and never mutated —
    // safe for a CDN or browser to cache aggressively (see #13).
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(upload.data);
  });

  // Collects unhandled client-side errors (uncaught exceptions, rejected
  // promises, React render errors) — the web equivalent of automatic
  // crash reporting. No read endpoint is exposed: reports may contain
  // stack traces/URLs from a user's session, so they're logged
  // server-side only rather than served back over an open API.
  app.post("/api/error-reports", (req, res) => {
    const { message, stack, url, userAgent } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const report = errorReportStore.record({
      message,
      stack: typeof stack === "string" ? stack : undefined,
      url: typeof url === "string" ? url : undefined,
      userAgent: typeof userAgent === "string" ? userAgent : undefined,
    });
    console.error(`[client error] ${report.message}`, report.url ?? "");
    res.status(202).json({ id: report.id });
  });

  // Google Sign-In: fully real verification (validates the ID token's
  // signature against Google's public keys and checks audience), gated
  // behind GOOGLE_CLIENT_ID since there's no "just log it" stand-in for
  // an actual OAuth client id.
  app.post("/api/auth/google", async (req, res) => {
    if (!googleAuthService.isConfigured()) {
      res.status(503).json({ error: "Google Sign-In is not configured on this server" });
      return;
    }

    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : undefined;
    if (!idToken) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }

    const profile = await googleAuthService.verify(idToken);
    if (!profile) {
      res.status(401).json({ error: "Invalid Google ID token" });
      return;
    }

    const user = userStore.findOrCreateByGoogle(profile);
    duplicateAccountStore.recordSignIn(user.id, req.ip, req.body?.deviceFingerprint);
    const tokens = tokenService.issueTokens(user.id);
    res.json({ user, tokens });
  });

  // Sign in with Apple: same shape as Google Sign-In — real verification
  // (fetches Apple's JWKS, validates signature/issuer/audience/expiry),
  // gated behind APPLE_SERVICES_ID.
  app.post("/api/auth/apple", async (req, res) => {
    if (!appleAuthService.isConfigured()) {
      res.status(503).json({ error: "Sign in with Apple is not configured on this server" });
      return;
    }

    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : undefined;
    if (!idToken) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }

    const profile = await appleAuthService.verify(idToken);
    if (!profile) {
      res.status(401).json({ error: "Invalid Apple ID token" });
      return;
    }

    const user = userStore.findOrCreateByApple(profile);
    duplicateAccountStore.recordSignIn(user.id, req.ip, req.body?.deviceFingerprint);
    const tokens = tokenService.issueTokens(user.id);
    res.json({ user, tokens });
  });

  // Sign in with Facebook: verifies the client-supplied access token via
  // the Graph API's debug_token endpoint (confirms it's genuine, unexpired,
  // and issued to *our* app specifically) before fetching the profile.
  app.post("/api/auth/facebook", async (req, res) => {
    if (!facebookAuthService.isConfigured()) {
      res.status(503).json({ error: "Facebook Sign-In is not configured on this server" });
      return;
    }

    const accessToken = typeof req.body?.accessToken === "string" ? req.body.accessToken : undefined;
    if (!accessToken) {
      res.status(400).json({ error: "accessToken is required" });
      return;
    }

    const profile = await facebookAuthService.verify(accessToken);
    if (!profile) {
      res.status(401).json({ error: "Invalid Facebook access token" });
      return;
    }

    const user = userStore.findOrCreateByFacebook(profile);
    duplicateAccountStore.recordSignIn(user.id, req.ip, req.body?.deviceFingerprint);
    const tokens = tokenService.issueTokens(user.id);
    res.json({ user, tokens });
  });

  // Account recovery for this passwordless app: an email-based access-
  // recovery code for when a user can no longer complete phone
  // verification (lost/changed number). Mirrors #21's OTP mechanics.
  app.post("/api/auth/recovery/request-code", (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ error: "A valid email address is required" });
      return;
    }

    const result = recoveryCodeService.requestCode(email);
    if ("error" in result) {
      res.status(429).json({ error: "Please wait before requesting another code", retryAfterMs: result.retryAfterMs });
      return;
    }

    // Stand-in for a real email provider (SES, SendGrid, etc.), which needs
    // credentials this environment doesn't have. Never included in the
    // HTTP response.
    console.log(`[recovery] ${email}: ${result.code} (expires in 15 minutes)`);
    res.status(202).json({ message: "Recovery code sent" });
  });

  app.post("/api/auth/recovery/verify-code", (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === "string" ? req.body.code : undefined;
    if (!email || !code) {
      res.status(400).json({ error: "email and code are required" });
      return;
    }

    const result = recoveryCodeService.verifyCode(email, code);
    if (!result.success) {
      const status = result.error === "invalid" ? 400 : result.error === "expired" ? 410 : 429;
      res.status(status).json({ error: result.error });
      return;
    }

    const user = userStore.findOrCreateByEmail(email);
    const tokens = tokenService.issueTokens(user.id);
    res.status(200).json({ user, tokens });
  });

  // Two-factor authentication (TOTP, RFC 6238): setup/confirm-setup/disable/
  // status manage the *current* user's own 2FA and are gated behind
  // requireAuth (userId comes from the verified access token, not the
  // request body/params) now that #21-#25's TokenService exists to check
  // against — the original unsafe client-supplied-userId design this issue
  // shipped with, fixed as part of merging it in.
  //
  // `verify` is intentionally NOT gated the same way: it runs at login
  // time, before a full session exists, so there's no access token yet to
  // check. None of the five sign-in endpoints above currently pause to
  // require a 2FA code before issuing tokens — wiring "issue a pending
  // token, then require /2fa/verify before the real one" into all five is
  // a real follow-up, left for whenever 2FA actually needs to be mandatory
  // rather than a standalone opt-in demonstrated at /settings/security.
  app.post("/api/auth/2fa/setup", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const accountLabel = typeof req.body?.accountLabel === "string" ? req.body.accountLabel : userId;
    const result = await twoFactorService.beginSetup(userId, accountLabel);
    res.status(200).json(result);
  });

  app.post("/api/auth/2fa/confirm-setup", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const token = typeof req.body?.token === "string" ? req.body.token : undefined;
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }
    const confirmed = twoFactorService.confirmSetup(userId, token);
    if (!confirmed) {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }
    res.json({ enabled: true });
  });

  app.post("/api/auth/2fa/verify", (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const token = typeof req.body?.token === "string" ? req.body.token : undefined;
    if (!userId || !token) {
      res.status(400).json({ error: "userId and token are required" });
      return;
    }
    const valid = twoFactorService.verify(userId, token);
    if (!valid) {
      res.status(401).json({ error: "Invalid or expired code" });
      return;
    }
    res.json({ verified: true });
  });

  app.get("/api/auth/2fa/status", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    res.json({ enabled: twoFactorService.isEnabled(userId) });
  });

  app.post("/api/auth/2fa/disable", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    twoFactorService.disable(userId);
    res.json({ enabled: false });
  });

  // WebAuthn (Face ID / fingerprint / Windows Hello) login. Registering a
  // new credential is gated behind requireAuth for the same reason as
  // #26's 2FA setup: only the signed-in owner of an account may enroll a
  // biometric credential for it. Login itself runs pre-session (there's no
  // access token yet to check), so it identifies the account by userId —
  // the client remembers which account it last registered on this device,
  // the same way a phone remembers whose Face ID unlocks a banking app.
  app.post("/api/auth/webauthn/register/options", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const username = typeof req.body?.username === "string" ? req.body.username : userId;
    const options = await webAuthnService.generateRegistrationOptions(userId, username);
    res.json(options);
  });

  app.post("/api/auth/webauthn/register/verify", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const response = req.body?.response;
    if (!response) {
      res.status(400).json({ error: "response is required" });
      return;
    }
    const verified = await webAuthnService.verifyRegistration(userId, response);
    if (!verified) {
      res.status(400).json({ error: "Could not verify the new credential" });
      return;
    }
    res.json({ verified: true });
  });

  app.post("/api/auth/webauthn/login/options", async (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const options = await webAuthnService.generateAuthenticationOptions(userId);
    if (!options) {
      res.status(404).json({ error: "No biometric credential registered for this user" });
      return;
    }
    res.json(options);
  });

  app.post("/api/auth/webauthn/login/verify", async (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const response = req.body?.response;
    if (!userId || !response) {
      res.status(400).json({ error: "userId and response are required" });
      return;
    }
    const verified = await webAuthnService.verifyAuthentication(userId, response);
    if (!verified) {
      res.status(401).json({ error: "Biometric verification failed" });
      return;
    }
    const tokens = tokenService.issueTokens(userId);
    res.json({ tokens });
  });

  app.get("/api/auth/webauthn/status", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    res.json({ hasCredentials: webAuthnService.hasCredentials(userId) });
  });

  // Phone + OTP signup. The chat itself still uses anonymous guest
  // identities — wiring this auth into ChatRoom is left for a follow-up
  // once more auth/profile issues land, so this stays additive.
  app.post("/api/auth/signup/request-otp", (req, res) => {
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
    if (!phoneNumber) {
      res.status(400).json({ error: "A valid phone number (E.164-ish, e.g. +15551234567) is required" });
      return;
    }

    const result = otpService.requestOtp(phoneNumber);
    if ("error" in result) {
      res.status(429).json({ error: "Please wait before requesting another code", retryAfterMs: result.retryAfterMs });
      return;
    }

    // Stand-in for a real SMS provider (Twilio, etc.), which needs
    // credentials this environment doesn't have. The code is deliberately
    // never included in the HTTP response.
    console.log(`[otp] ${phoneNumber}: ${result.code} (expires in 5 minutes)`);
    res.status(202).json({ message: "Verification code sent" });
  });

  app.post("/api/auth/signup/verify-otp", (req, res) => {
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
    const code = typeof req.body?.code === "string" ? req.body.code : undefined;
    if (!phoneNumber || !code) {
      res.status(400).json({ error: "phoneNumber and code are required" });
      return;
    }

    const result = otpService.verifyOtp(phoneNumber, code);
    if (!result.success) {
      const status = result.error === "invalid" ? 400 : result.error === "expired" ? 410 : 429;
      res.status(status).json({ error: result.error });
      return;
    }

    const user = userStore.findOrCreate(phoneNumber);
    duplicateAccountStore.recordSignIn(user.id, req.ip, req.body?.deviceFingerprint);
    const tokens = tokenService.issueTokens(user.id);
    res.status(200).json({ user, tokens });
  });

  // Duplicate/intrusive-account detection: flags accounts that share an IP
  // or device fingerprint with another account (see duplicateAccounts.ts).
  // Only the caller's own status is ever exposed — gated behind requireAuth
  // rather than a client-supplied userId, since this can reveal something
  // about other accounts (that a match exists).
  app.get("/api/auth/duplicate-status", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    res.json(duplicateAccountStore.getStatus(userId));
  });

  // "Don't show my profile to people from my city/workplace" (#54): stores
  // the preference and the pure matching check a future discovery/matching
  // feature would call before showing this profile to another — same
  // scoping as #33's search radius, which stores a preference well before
  // any "nearby" feature consumes it.
  app.get("/api/discovery-visibility", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    res.json(discoveryVisibilityStore.getPreferences(userId));
  });

  app.put("/api/discovery-visibility", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const result = discoveryVisibilityStore.setPreferences(userId, req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.preferences);
  });

  app.post("/api/auth/refresh", (req, res) => {
    const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
    if (!refreshToken) {
      res.status(400).json({ error: "refreshToken is required" });
      return;
    }
    const tokens = tokenService.refresh(refreshToken);
    if (!tokens) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }
    res.json({ tokens });
  });

  return {
    app,
    messagesByRoom,
    pushService,
    errorReportStore,
    otpService,
    recoveryCodeService,
    twoFactorService,
    webAuthnService,
    onboardingStore,
    verificationStore,
    reportStore,
    blockStore,
    contactBlockStore,
    watermarkStore,
    photoStore,
    sharedDateStore,
    sosStore,
    webAuthnStore,
    duplicateAccountStore,
    discoveryVisibilityStore,
  };
}

export async function createChatServer() {
  const { app, messagesByRoom, pushService } = createApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const redisAdapter = await createRedisAdapterIfConfigured();
  if (redisAdapter) io.adapter(redisAdapter);

  const messageRateLimiter = new RateLimiter(MESSAGE_RATE_LIMIT, MESSAGE_RATE_WINDOW_MS);

  io.on("connection", (socket) => {
    socket.on("join", (roomId: string = DEFAULT_ROOM_ID) => {
      socket.join(roomId);
    });

    socket.on("message:send", (payload: SendMessagePayload) => {
      if (!messageRateLimiter.isAllowed(socket.id)) {
        socket.emit("message:rejected", { reason: "rate_limited" });
        return;
      }

      // Guest mode is read-only by design (Tinder-style limited access
      // without signing up): reject a send even if a client bypasses the
      // disabled UI and emits directly.
      if (!isGuestSendAllowed(payload)) {
        socket.emit("message:rejected", { reason: "guest_mode" });
        return;
      }

      const roomId = payload.roomId || DEFAULT_ROOM_ID;
      const message: ChatMessage = buildChatMessage(payload);
      const existing = messagesByRoom.get(roomId) ?? [];
      existing.push(message);
      messagesByRoom.set(roomId, existing);
      io.to(roomId).emit("message:new", message);
      pushService.notifyOthers(message.author, { title: message.author, body: message.text }).catch((err) => {
        console.error("Failed to deliver push notifications:", err);
      });
    });

    socket.on("disconnect", () => {
      messageRateLimiter.clear(socket.id);
    });
  });

  return httpServer;
}

if (require.main === module) {
  createChatServer().then((httpServer) => {
    httpServer.listen(PORT, () => {
      console.log(`ChatApp API listening on port ${PORT}`);
    });

    // Under a load balancer/orchestrator, instances are routinely stopped
    // (rolling deploys, autoscaling down) — exiting without draining
    // connections would drop in-flight requests for other users.
    const shutdown = (signal: string) => {
      console.log(`${signal} received, shutting down gracefully`);
      httpServer.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  });
}
