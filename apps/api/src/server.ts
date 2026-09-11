import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, ONBOARDING_STEPS, OnboardingStep, SendMessagePayload } from "@chatapp/shared";
import { describeUserAgent, normalizePhoneNumber, OtpService, TokenService, UserStore } from "./auth";
import { TwoFactorService } from "./twoFactor";
import { SmsSecurityAlertStore } from "./smsSecurityAlerts";
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
import { VoiceNoteStore } from "./voiceNotes";
import { SelfDestructPhotoStore } from "./selfDestructPhotos";
import { ReadReceiptStore } from "./readReceipts";
import { TypingStore } from "./typing";
import { LiveLocationShareStore } from "./liveLocationShares";
import { CallStore } from "./calls";
import { checkVideoCallEligibility } from "./videoCallGate";
import { VideoCallEffectsStore } from "./videoCallEffects";
import { generateIcebreakers } from "./icebreakers";
import { canEditMessage } from "./messageEditing";
import { canDeleteMessage } from "./messageDeletion";
import { canSendFirstMessage } from "./firstMessageRule";
import { GenderInfoStore } from "./genderInfo";
import { MatchExpiryStore, MATCH_RESPONSE_WINDOW_MS } from "./matchExpiry";
import { VerificationStore } from "./verification";
import { isGuestSendAllowed } from "./guestMode";
import { ReportStore } from "./reports";
import { MessageDraftStore } from "./messageDrafts";
import { PublicKeyStore } from "./e2eeKeys";
import { BlockStore } from "./blocks";
import { ContactBlockStore } from "./contactBlocks";
import { PinnedChatsStore } from "./pinnedChats";
import { ArchivedChatsStore } from "./archivedChats";
import { searchMessages } from "./messageSearch";
import { WatermarkStore } from "./watermark";
import { PhotoStore, ALLOWED_PHOTO_MIME_TYPES } from "./photos";
import { SharedDateStore } from "./sharedDates";
import { SOSStore } from "./sos";
import { applyWatermark } from "./watermarkImage";
import { DuplicateAccountStore } from "./duplicateAccounts";
import { DiscoveryVisibilityStore } from "./discoveryVisibility";
import { scanForScamContent } from "./scamDetector";
import { createGame, applyMove } from "./ticTacToe";
import { DATE_PROPOSAL_LABELS, isDateProposalCategory } from "./dateProposals";
import { createDateInvite, respondToDateInvite } from "./dateInvites";
import { RecaptchaService } from "./recaptcha";
import { scanForSpamContent, SPAM_DETECTOR_REPORTER_AUTHOR } from "./spamDetector";
import { scanForInappropriateContent, CONTENT_WARNING_REPORTER_AUTHOR } from "./contentWarning";
import { PhotoAlbumStore } from "./photoAlbums";
import { IntroVideoStore } from "./introVideo";
import { VoiceIntroStore } from "./voiceIntro";
import { BioStore } from "./bio";
import { ProfilePromptsStore, PROFILE_PROMPT_CATALOG } from "./profilePrompts";
import { JobInfoStore } from "./jobInfo";
import { EducationInfoStore } from "./educationInfo";
import { HeightInfoStore } from "./heightInfo";
import { LifestyleInfoStore } from "./lifestyleInfo";
import { FamilyPlansInfoStore } from "./familyPlansInfo";
import { ZodiacInfoStore } from "./zodiacInfo";
import { LanguagesInfoStore, LANGUAGE_CATALOG } from "./languagesInfo";
import { BeliefsInfoStore } from "./beliefsInfo";
import { PetsInfoStore, PET_CATALOG } from "./petsInfo";
import { PersonalityInfoStore } from "./personalityInfo";
import { SpotifyService } from "./spotifyAuth";
import { GiphyService, GIPHY_CONTENT_TYPES, GiphyContentType } from "./giphy";
import { TranslationService } from "./translation";
import { SpotifyInfoStore } from "./spotifyInfo";
import { InstagramService } from "./instagramAuth";
import { InstagramInfoStore } from "./instagramInfo";
import { InterestsInfoStore, INTEREST_CATALOG } from "./interestsInfo";
import { ProfileVisibilityStore } from "./profileVisibility";
import { SocialLinksInfoStore, SOCIAL_PLATFORMS } from "./socialLinksInfo";
import { TravelModeInfoStore } from "./travelModeInfo";
import { ProfileColorThemeStore, PROFILE_COLOR_THEMES } from "./profileColorTheme";
import { AchievementsInfoStore } from "./achievementsInfo";
import { DisplayNameModeStore, DISPLAY_NAME_MODES } from "./displayNameMode";
import { StylizedAvatarStore, AVATAR_STYLES } from "./stylizedAvatar";
import { SwipeStore } from "./swipes";
import { SmartScoreStore } from "./smartScore";
import { DiscoveryFiltersStore, candidateMatchesFilters } from "./discoveryFilters";
import { ExploreModeStore, candidateMatchesExploreMode, EXPLORE_MODES } from "./exploreMode";
import { TopPicksStore } from "./topPicks";
import { ProfileVisitsStore } from "./profileVisits";
import { ProfileBoostStore } from "./profileBoost";
import { PeakHoursStore } from "./peakHours";
import { scanCandidateForFakeProfile } from "./fakeProfileDetector";
import { isSenderPhotoSuspicious } from "./photoWarning";
import { CrossedPathsStore } from "./crossedPaths";
import { SquadStore } from "./squads";
import { PresenceStore } from "./presence";
import { VanishModeStore } from "./vanishMode";
import { PhotoInteractionStore } from "./photoInteractions";
import { bioMatchesKeyword } from "./bioSearch";
import { ContactsGraphStore } from "./contactsGraph";
import { ViewModeStore } from "./viewMode";
import { computeMusicMatch } from "./musicMatch";
import { WeekendPlansStore, WEEKEND_PLAN_CATALOG } from "./weekendPlans";
import { computeWeekendPlanMatch } from "./weekendPlanMatch";
import { computeBioMatch } from "./bioAnalysis";
import { computeInterestCompatibility } from "./interestCompatibility";
import { buildProfilePreview } from "./profilePreview";
import { computeProfileCompletion } from "./profileCompletion";
import { optimizePhoto } from "./photoOptimization";

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
  recaptchaService?: RecaptchaService;
  spotifyService?: SpotifyService;
  giphyService?: GiphyService;
  instagramService?: InstagramService;
  translationService?: TranslationService;
}): {
  app: Express;
  messagesByRoom: Map<string, ChatMessage[]>;
  pushService: PushService;
  errorReportStore: ErrorReportStore;
  otpService: OtpService;
  recoveryCodeService: RecoveryCodeService;
  twoFactorService: TwoFactorService;
  smsSecurityAlertStore: SmsSecurityAlertStore;
  webAuthnService: WebAuthnService;
  onboardingStore: OnboardingStore;
  verificationStore: VerificationStore;
  reportStore: ReportStore;
  blockStore: BlockStore;
  contactBlockStore: ContactBlockStore;
  pinnedChatsStore: PinnedChatsStore;
  archivedChatsStore: ArchivedChatsStore;
  watermarkStore: WatermarkStore;
  photoStore: PhotoStore;
  sharedDateStore: SharedDateStore;
  sosStore: SOSStore;
  webAuthnStore: WebAuthnStore;
  duplicateAccountStore: DuplicateAccountStore;
  discoveryVisibilityStore: DiscoveryVisibilityStore;
  photoAlbumStore: PhotoAlbumStore;
  introVideoStore: IntroVideoStore;
  voiceIntroStore: VoiceIntroStore;
  bioStore: BioStore;
  profilePromptsStore: ProfilePromptsStore;
  jobInfoStore: JobInfoStore;
  educationInfoStore: EducationInfoStore;
  heightInfoStore: HeightInfoStore;
  lifestyleInfoStore: LifestyleInfoStore;
  familyPlansInfoStore: FamilyPlansInfoStore;
  zodiacInfoStore: ZodiacInfoStore;
  languagesInfoStore: LanguagesInfoStore;
  beliefsInfoStore: BeliefsInfoStore;
  petsInfoStore: PetsInfoStore;
  personalityInfoStore: PersonalityInfoStore;
  spotifyInfoStore: SpotifyInfoStore;
  instagramInfoStore: InstagramInfoStore;
  interestsInfoStore: InterestsInfoStore;
  profileVisibilityStore: ProfileVisibilityStore;
  socialLinksInfoStore: SocialLinksInfoStore;
  travelModeInfoStore: TravelModeInfoStore;
  profileColorThemeStore: ProfileColorThemeStore;
  achievementsInfoStore: AchievementsInfoStore;
  displayNameModeStore: DisplayNameModeStore;
  stylizedAvatarStore: StylizedAvatarStore;
  swipeStore: SwipeStore;
  smartScoreStore: SmartScoreStore;
  discoveryFiltersStore: DiscoveryFiltersStore;
  exploreModeStore: ExploreModeStore;
  topPicksStore: TopPicksStore;
  profileVisitsStore: ProfileVisitsStore;
  profileBoostStore: ProfileBoostStore;
  peakHoursStore: PeakHoursStore;
  crossedPathsStore: CrossedPathsStore;
  squadStore: SquadStore;
  presenceStore: PresenceStore;
  vanishModeStore: VanishModeStore;
  photoInteractionStore: PhotoInteractionStore;
  contactsGraphStore: ContactsGraphStore;
  viewModeStore: ViewModeStore;
  weekendPlansStore: WeekendPlansStore;
  readReceiptStore: ReadReceiptStore;
  typingStore: TypingStore;
  liveLocationShareStore: LiveLocationShareStore;
  callStore: CallStore;
  videoCallEffectsStore: VideoCallEffectsStore;
  genderInfoStore: GenderInfoStore;
  matchExpiryStore: MatchExpiryStore;
} {
  const app = express();
  // Custom response headers aren't visible to browser fetch() by default —
  // must be explicitly exposed via CORS for the client to read X-Has-More.
  app.use(cors({ exposedHeaders: ["X-Has-More"] }));
  // Base64-encoded media is ~33% larger than its binary size, so allow a
  // generous body limit even though individual uploads are capped in their
  // own stores after decoding. Raised from 10mb to fit #63's 20MB video cap
  // (~27MB base64) on top of the existing 5MB image/upload caps.
  app.use(express.json({ limit: "30mb" }));

  const messagesByRoom = new Map<string, ChatMessage[]>();
  const locations = new LocationStore();
  const pushService = new PushService();
  const uploadStore = new UploadStore();
  const voiceNoteStore = new VoiceNoteStore();
  const selfDestructPhotoStore = new SelfDestructPhotoStore();
  const errorReportStore = new ErrorReportStore();
  const otpService = new OtpService();
  const recoveryCodeService = new RecoveryCodeService();
  const userStore = new UserStore();
  const tokenService = new TokenService();
  const twoFactorService = new TwoFactorService();
  const smsSecurityAlertStore = new SmsSecurityAlertStore();
  const webAuthnService = new WebAuthnService({
    rpId: process.env.WEBAUTHN_RP_ID ?? "localhost",
    origin: process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000",
  });
  const verificationStore = new VerificationStore();
  const onboardingStore = new OnboardingStore(verificationStore);
  const reportStore = new ReportStore();
  const messageDraftStore = new MessageDraftStore();
  const publicKeyStore = new PublicKeyStore();
  const blockStore = new BlockStore();
  const contactBlockStore = new ContactBlockStore();
  const pinnedChatsStore = new PinnedChatsStore();
  const archivedChatsStore = new ArchivedChatsStore();
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
  const photoAlbumStore = new PhotoAlbumStore();
  const introVideoStore = new IntroVideoStore();
  const voiceIntroStore = new VoiceIntroStore();
  const bioStore = new BioStore();
  const profilePromptsStore = new ProfilePromptsStore();
  const jobInfoStore = new JobInfoStore();
  const educationInfoStore = new EducationInfoStore();
  const heightInfoStore = new HeightInfoStore();
  const lifestyleInfoStore = new LifestyleInfoStore();
  const familyPlansInfoStore = new FamilyPlansInfoStore();
  const zodiacInfoStore = new ZodiacInfoStore();
  const languagesInfoStore = new LanguagesInfoStore();
  const beliefsInfoStore = new BeliefsInfoStore();
  const petsInfoStore = new PetsInfoStore();
  const personalityInfoStore = new PersonalityInfoStore();
  const spotifyInfoStore = new SpotifyInfoStore();
  const instagramInfoStore = new InstagramInfoStore();
  const interestsInfoStore = new InterestsInfoStore();
  const profileVisibilityStore = new ProfileVisibilityStore();
  const socialLinksInfoStore = new SocialLinksInfoStore();
  const travelModeInfoStore = new TravelModeInfoStore();
  const profileColorThemeStore = new ProfileColorThemeStore();
  const achievementsInfoStore = new AchievementsInfoStore();
  const displayNameModeStore = new DisplayNameModeStore();
  const stylizedAvatarStore = new StylizedAvatarStore();
  const swipeStore = new SwipeStore();
  const smartScoreStore = new SmartScoreStore();
  const discoveryFiltersStore = new DiscoveryFiltersStore();
  const exploreModeStore = new ExploreModeStore();
  const topPicksStore = new TopPicksStore();
  const profileVisitsStore = new ProfileVisitsStore();
  const profileBoostStore = new ProfileBoostStore();
  const peakHoursStore = new PeakHoursStore();
  const crossedPathsStore = new CrossedPathsStore();
  const squadStore = new SquadStore();
  const presenceStore = new PresenceStore();
  const vanishModeStore = new VanishModeStore();
  const photoInteractionStore = new PhotoInteractionStore();
  const contactsGraphStore = new ContactsGraphStore();
  const viewModeStore = new ViewModeStore();
  const weekendPlansStore = new WeekendPlansStore();
  const readReceiptStore = new ReadReceiptStore();
  const typingStore = new TypingStore();
  const liveLocationShareStore = new LiveLocationShareStore();
  const callStore = new CallStore();
  const videoCallEffectsStore = new VideoCallEffectsStore();
  const genderInfoStore = new GenderInfoStore();
  const matchExpiryStore = new MatchExpiryStore();
  const TOP_PICKS_POOL_SIZE = 50;
  // Injectable so tests can exercise real branching logic (configured vs.
  // not, valid vs. invalid token) without a real Google Cloud project.
  const googleAuthService = deps?.googleAuthService ?? new GoogleAuthService();
  const appleAuthService = deps?.appleAuthService ?? new AppleAuthService();
  const facebookAuthService = deps?.facebookAuthService ?? new FacebookAuthService();
  const recaptchaService = deps?.recaptchaService ?? new RecaptchaService();
  const spotifyService = deps?.spotifyService ?? new SpotifyService();
  const giphyService = deps?.giphyService ?? new GiphyService();
  const instagramService = deps?.instagramService ?? new InstagramService();
  const translationService = deps?.translationService ?? new TranslationService();

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

  // Same verification as requireAuth, but also surfaces which session the
  // caller is using — needed by the active-sessions endpoints below (#60)
  // to mark "this device" and to exclude it from "log out of others".
  function requireAuthWithSession(req: express.Request, res: express.Response): { userId: string; sessionId: string } | undefined {
    const header = req.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    const verified = token ? tokenService.verifyAccessToken(token) : undefined;
    if (!verified?.sessionId) {
      res.status(401).json({ error: "A valid Authorization: Bearer <accessToken> header is required" });
      return undefined;
    }
    return { userId: verified.userId, sessionId: verified.sessionId };
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

  // Bumble's real "save message drafts" (#150) — server-persisted (not
  // just localStorage) so a draft survives across devices/browsers, same
  // shape as pinnedChats.ts's per-author preference store.
  app.put("/api/message-drafts/:author/:roomId", (req, res) => {
    const result = messageDraftStore.save(req.params.author, req.params.roomId, req.body?.text);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ success: true });
  });

  app.get("/api/message-drafts/:author/:roomId", (req, res) => {
    res.json({ text: messageDraftStore.get(req.params.author, req.params.roomId) });
  });

  // Feeld's real optional end-to-end encrypted chat (#149) — the server
  // only relays public keys (see e2eeKeys.ts's PublicKeyStore doc comment
  // for why it never sees a private key or plaintext).
  app.put("/api/e2ee/public-key/:author", (req, res) => {
    const result = publicKeyStore.publish(req.params.author, req.body?.publicKeyJwk);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ success: true });
  });

  app.get("/api/e2ee/public-key/:author", (req, res) => {
    const publicKeyJwk = publicKeyStore.get(req.params.author);
    if (!publicKeyJwk) {
      res.status(404).json({ error: "No public key published for this author" });
      return;
    }
    res.json({ publicKeyJwk });
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

  // Bumble's real "Pin important chats to the top of the list" (#138).
  // One-sided like blocking above — pinning is per-viewer, not mutual.
  app.post("/api/pinned-chats", (req, res) => {
    const result = pinnedChatsStore.pin(req.body?.viewerAuthor, req.body?.chatAuthor);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ pinned: true });
  });

  app.delete("/api/pinned-chats", (req, res) => {
    const result = pinnedChatsStore.unpin(req.body?.viewerAuthor, req.body?.chatAuthor);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(204).send();
  });

  app.get("/api/pinned-chats/:viewerAuthor", (req, res) => {
    res.json({ pinnedChats: pinnedChatsStore.getPinnedChats(req.params.viewerAuthor) });
  });

  // Bumble's real "Archive old chats" (#139). One-sided like pinning above
  // — archiving is a per-viewer list preference, not a mutual/shared flag,
  // and doesn't affect matching or #136/#137's expiry timer at all.
  app.post("/api/archived-chats", (req, res) => {
    const result = archivedChatsStore.archive(req.body?.viewerAuthor, req.body?.chatAuthor);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ archived: true });
  });

  app.delete("/api/archived-chats", (req, res) => {
    const result = archivedChatsStore.unarchive(req.body?.viewerAuthor, req.body?.chatAuthor);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(204).send();
  });

  app.get("/api/archived-chats/:viewerAuthor", (req, res) => {
    res.json({ archivedChats: archivedChatsStore.getArchivedChats(req.params.viewerAuthor) });
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
  app.post("/api/photos", async (req, res) => {
    // Smart photo optimization (#82): downscale oversized photos and strip
    // EXIF metadata (including any GPS location tag) before storing. Runs
    // best-effort — if the bytes aren't a decodable image, fall through
    // unmodified and let photoStore.upload's own validation reject them
    // with its usual error message, same as before this existed.
    let mimeType = req.body?.mimeType;
    let data = req.body?.data;
    if (typeof data === "string" && typeof mimeType === "string" && ALLOWED_PHOTO_MIME_TYPES.has(mimeType)) {
      try {
        const optimized = await optimizePhoto(Buffer.from(data, "base64"));
        mimeType = optimized.mimeType;
        data = optimized.data.toString("base64");
      } catch {
        // Not a decodable image — leave mimeType/data as received.
      }
    }

    const result = photoStore.upload(req.body?.author, mimeType, data);
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
    const requestedViewer = typeof req.query.viewer === "string" ? req.query.viewer.trim() : "";
    // #59's album access level (public/private/request-access) gates the
    // photo itself, ahead of the #45 watermarking step below.
    if (!photoAlbumStore.canView(requestedViewer, photo.author)) {
      res.status(403).json({ error: "This album isn't public — request access from its owner" });
      return;
    }
    const viewer = requestedViewer || "ChatApp";
    try {
      const watermarked = await applyWatermark(photo.data, viewer);
      res.setHeader("Content-Type", "image/png");
      res.status(200).send(watermarked);
    } catch {
      res.status(500).json({ error: "Failed to render photo" });
    }
  });

  // Photo album access level (#59): Bumble's real "Private Album" control,
  // generalized to public/private/request-access. Its own high-priority
  // path, same as Report/Block, gating #45's photo serve above.
  app.put("/api/photo-albums/:owner/access-level", (req, res) => {
    const result = photoAlbumStore.setAccessLevel(req.params.owner, req.body?.accessLevel);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ accessLevel: result.accessLevel });
  });

  app.get("/api/photo-albums/:owner/access-level", (req, res) => {
    res.json({ accessLevel: photoAlbumStore.getAccessLevel(req.params.owner) });
  });

  app.post("/api/photo-albums/:owner/access-requests", (req, res) => {
    const result = photoAlbumStore.requestAccess(req.body?.requester, req.params.owner);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ success: true });
  });

  // Self-declared trust boundary, same as Block's list endpoint: the owner
  // param is client-supplied (chat identity isn't wired to real accounts
  // yet), but only the claimed owner's own pending requests are returned —
  // never anything that would leak one requester's interest to another.
  app.get("/api/photo-albums/:owner/access-requests", (req, res) => {
    res.json({ pending: photoAlbumStore.listPendingRequests(req.params.owner) });
  });

  app.post("/api/photo-albums/:owner/access-requests/:requester/respond", (req, res) => {
    const result = photoAlbumStore.respondToRequest(req.params.owner, req.params.requester, req.body?.approve);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ success: true });
  });

  // Photo album, up to 9 photos (#61): a photo must already be uploaded via
  // POST /api/photos before it can be added here — this endpoint only
  // manages membership/order, not the raw bytes.
  app.post("/api/photo-albums/:owner/photos", (req, res) => {
    const photoId = req.body?.photoId;
    const photo = typeof photoId === "string" ? photoStore.get(photoId) : undefined;
    if (!photo || photo.author !== req.params.owner) {
      res.status(400).json({ error: "photoId must reference a photo you uploaded" });
      return;
    }
    const result = photoAlbumStore.addPhoto(req.params.owner, photoId);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ photoIds: result.photoIds });
  });

  app.get("/api/photo-albums/:owner/photos", (req, res) => {
    res.json({ photoIds: photoAlbumStore.listPhotos(req.params.owner) });
  });

  app.delete("/api/photo-albums/:owner/photos/:photoId", (req, res) => {
    const result = photoAlbumStore.removePhoto(req.params.owner, req.params.photoId);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ photoIds: result.photoIds });
  });

  // Drag-and-drop reordering (#62): the client sends the full desired
  // order, which must be exactly the photos already in the album.
  app.put("/api/photo-albums/:owner/photos/order", (req, res) => {
    const result = photoAlbumStore.reorderPhotos(req.params.owner, req.body?.photoIds);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ photoIds: result.photoIds });
  });

  // Short looping intro video (#63): one per profile, deliberately simpler
  // than the photo album — see introVideo.ts for why (no watermarking, no
  // multi-clip/access-level model).
  app.post("/api/intro-video", (req, res) => {
    const result = introVideoStore.upload(req.body?.author, req.body?.mimeType, req.body?.data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ success: true });
  });

  app.get("/api/intro-video/:author", (req, res) => {
    const video = introVideoStore.get(req.params.author);
    if (!video) {
      res.status(404).json({ error: "No intro video for this author" });
      return;
    }
    res.setHeader("Content-Type", video.mimeType);
    res.status(200).send(video.data);
  });

  app.delete("/api/intro-video/:author", (req, res) => {
    introVideoStore.remove(req.params.author);
    res.status(204).send();
  });

  // Hinge-style 30-second voice intro (#64): same one-per-profile,
  // replace-on-reupload shape as #63's intro video, audio mime types only.
  app.post("/api/voice-intro", (req, res) => {
    const result = voiceIntroStore.upload(req.body?.author, req.body?.mimeType, req.body?.data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ success: true });
  });

  app.get("/api/voice-intro/:author", (req, res) => {
    const clip = voiceIntroStore.get(req.params.author);
    if (!clip) {
      res.status(404).json({ error: "No voice intro for this author" });
      return;
    }
    res.setHeader("Content-Type", clip.mimeType);
    res.status(200).send(clip.data);
  });

  app.delete("/api/voice-intro/:author", (req, res) => {
    voiceIntroStore.remove(req.params.author);
    res.status(204).send();
  });

  // Editable-anytime text bio (#65), independent of the one-time bio
  // collected during onboarding — see bio.ts.
  app.put("/api/bio/:author", (req, res) => {
    const result = bioStore.update(req.params.author, req.body?.bio);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ bio: result.bio });
  });

  app.get("/api/bio/:author", (req, res) => {
    res.json({ bio: bioStore.get(req.params.author) });
  });

  // Hinge-style ready-made profile prompts (#66): pick up to 3 from a fixed
  // catalog and answer each — same one-set-per-author, replace-on-update
  // shape as other standalone profile fields in this app.
  app.get("/api/profile-prompts/catalog", (_req, res) => {
    res.json({ prompts: PROFILE_PROMPT_CATALOG });
  });

  app.put("/api/profile-prompts/:author", (req, res) => {
    const result = profilePromptsStore.setAnswers(req.params.author, req.body?.answers);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ answers: result.answers });
  });

  app.get("/api/profile-prompts/:author", (req, res) => {
    res.json({ answers: profilePromptsStore.getAnswers(req.params.author) });
  });

  // Editable-anytime job title + workplace (#67), same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields.
  app.put("/api/job-info/:author", (req, res) => {
    const result = jobInfoStore.update(req.params.author, req.body?.jobTitle, req.body?.company, req.body?.hideCompany);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ jobInfo: result.jobInfo });
  });

  app.get("/api/job-info/:author", (req, res) => {
    res.json({ jobInfo: jobInfoStore.get(req.params.author) });
  });

  // Editable-anytime school/university (#68), same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields.
  app.put("/api/education-info/:author", (req, res) => {
    const result = educationInfoStore.update(req.params.author, req.body?.school, req.body?.hideSchool);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ educationInfo: result.educationInfo });
  });

  app.get("/api/education-info/:author", (req, res) => {
    res.json({ educationInfo: educationInfoStore.get(req.params.author) });
  });

  // Editable-anytime height (#69), same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields.
  app.put("/api/height-info/:author", (req, res) => {
    const result = heightInfoStore.update(req.params.author, req.body?.heightCm, req.body?.hideHeight);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ heightInfo: result.heightInfo });
  });

  app.get("/api/height-info/:author", (req, res) => {
    res.json({ heightInfo: heightInfoStore.get(req.params.author) });
  });

  // Editable-anytime smoking/drinking status (#70), same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields.
  app.put("/api/lifestyle-info/:author", (req, res) => {
    const result = lifestyleInfoStore.update(
      req.params.author,
      req.body?.smoking,
      req.body?.drinking,
      req.body?.hideSmoking,
      req.body?.hideDrinking
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ lifestyleInfo: result.lifestyleInfo });
  });

  app.get("/api/lifestyle-info/:author", (req, res) => {
    res.json({ lifestyleInfo: lifestyleInfoStore.get(req.params.author) });
  });

  // Editable-anytime family/children plans (#71), same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields.
  app.put("/api/family-plans-info/:author", (req, res) => {
    const result = familyPlansInfoStore.update(req.params.author, req.body?.familyPlans, req.body?.hideFamilyPlans);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ familyPlansInfo: result.familyPlansInfo });
  });

  app.get("/api/family-plans-info/:author", (req, res) => {
    res.json({ familyPlansInfo: familyPlansInfoStore.get(req.params.author) });
  });

  // Editable-anytime zodiac sign (#72), derived server-side from a
  // birth month/day pair — same one-value-per-author, replace-on-update
  // shape as this app's other standalone profile fields.
  app.put("/api/zodiac-info/:author", (req, res) => {
    const result = zodiacInfoStore.update(req.params.author, req.body?.birthMonth, req.body?.birthDay, req.body?.hideZodiac);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ zodiacInfo: result.zodiacInfo });
  });

  app.get("/api/zodiac-info/:author", (req, res) => {
    res.json({ zodiacInfo: zodiacInfoStore.get(req.params.author) });
  });

  // Editable-anytime "languages I'm fluent in" (#73), same
  // one-value-per-author, replace-on-update shape as this app's other
  // standalone profile fields.
  app.get("/api/languages-info/catalog", (_req, res) => {
    res.json({ languages: LANGUAGE_CATALOG });
  });

  app.put("/api/languages-info/:author", (req, res) => {
    const result = languagesInfoStore.update(req.params.author, req.body?.languages, req.body?.hideLanguages);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ languagesInfo: result.languagesInfo });
  });

  app.get("/api/languages-info/:author", (req, res) => {
    res.json({ languagesInfo: languagesInfoStore.get(req.params.author) });
  });

  // Editable-anytime religion/political-views (#74), same
  // one-value-per-author, replace-on-update shape as this app's other
  // standalone profile fields.
  app.put("/api/beliefs-info/:author", (req, res) => {
    const result = beliefsInfoStore.update(
      req.params.author,
      req.body?.religion,
      req.body?.politicalView,
      req.body?.hideReligion,
      req.body?.hidePoliticalView
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ beliefsInfo: result.beliefsInfo });
  });

  app.get("/api/beliefs-info/:author", (req, res) => {
    res.json({ beliefsInfo: beliefsInfoStore.get(req.params.author) });
  });

  // Editable-anytime pet status (#75), same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields.
  app.get("/api/pets-info/catalog", (_req, res) => {
    res.json({ pets: PET_CATALOG });
  });

  app.put("/api/pets-info/:author", (req, res) => {
    const result = petsInfoStore.update(req.params.author, req.body?.pets, req.body?.hidePets);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ petsInfo: result.petsInfo });
  });

  app.get("/api/pets-info/:author", (req, res) => {
    res.json({ petsInfo: petsInfoStore.get(req.params.author) });
  });

  // Editable-anytime personality type (#76): MBTI and Enneagram, same
  // one-value-per-author, replace-on-update shape as this app's other
  // standalone profile fields.
  app.put("/api/personality-info/:author", (req, res) => {
    const result = personalityInfoStore.update(
      req.params.author,
      req.body?.mbtiType,
      req.body?.enneagramType,
      req.body?.hideMbti,
      req.body?.hideEnneagram
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ personalityInfo: result.personalityInfo });
  });

  app.get("/api/personality-info/:author", (req, res) => {
    res.json({ personalityInfo: personalityInfoStore.get(req.params.author) });
  });

  // Connect Spotify to show top tracks (#77) — same "client does the OAuth
  // redirect, hands the server a code" shape as #25's Facebook sign-in,
  // adapted to Spotify's authorization-code flow. Distinct from
  // job/education/etc: the value comes from an external API fetch, not
  // user-typed input.
  app.post("/api/spotify/connect", async (req, res) => {
    if (!spotifyService.isConfigured()) {
      res.status(503).json({ error: "Spotify integration is not configured on this server" });
      return;
    }

    const author = typeof req.body?.author === "string" ? req.body.author.trim() : "";
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const redirectUri = typeof req.body?.redirectUri === "string" ? req.body.redirectUri : "";
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    if (!code || !redirectUri) {
      res.status(400).json({ error: "code and redirectUri are required" });
      return;
    }

    const profile = await spotifyService.fetchTopTracks(code, redirectUri);
    if (!profile) {
      res.status(401).json({ error: "Failed to connect Spotify account" });
      return;
    }

    res.json({ spotifyInfo: spotifyInfoStore.connect(author, profile.topTracks) });
  });

  app.delete("/api/spotify/:author", (req, res) => {
    res.json({ spotifyInfo: spotifyInfoStore.disconnect(req.params.author) });
  });

  app.put("/api/spotify-info/:author", (req, res) => {
    res.json({ spotifyInfo: spotifyInfoStore.setHideSpotify(req.params.author, req.body?.hideSpotify === true) });
  });

  app.get("/api/spotify-info/:author", (req, res) => {
    res.json({ spotifyInfo: spotifyInfoStore.get(req.params.author) });
  });

  // Tinder's real "send a GIF/sticker" (#124) via an actual Giphy
  // integration — the server proxies the search so GIPHY_API_KEY never
  // reaches the browser, same "server-only credential" shape as Spotify's
  // token exchange above. A result's `url` points at Giphy's own CDN, so
  // sending one is just a regular chat image message (imageUrl) — no
  // upload/storage of our own needed, unlike #122/#123's self-hosted media.
  app.get("/api/giphy/search", async (req, res) => {
    if (!giphyService.isConfigured()) {
      res.status(503).json({ error: "GIF/sticker search is not configured on this server" });
      return;
    }

    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!query) {
      res.status(400).json({ error: "q is required" });
      return;
    }
    const type = typeof req.query.type === "string" ? req.query.type : "gifs";
    if (!(GIPHY_CONTENT_TYPES as readonly string[]).includes(type)) {
      res.status(400).json({ error: `type must be one of: ${GIPHY_CONTENT_TYPES.join(", ")}` });
      return;
    }
    const limit = Number(req.query.limit);

    const results = await giphyService.search(query, type as GiphyContentType, Number.isFinite(limit) ? limit : undefined);
    if (!results) {
      res.status(502).json({ error: "Failed to fetch results from Giphy" });
      return;
    }
    res.json({ results });
  });

  // Bumble's real "See translation" (#145) via an actual Google Cloud
  // Translation API integration — the server proxies the request so
  // TRANSLATE_API_KEY never reaches the browser, same "server-only
  // credential" shape as the Giphy search above. On-demand per message
  // (the client sends the text it wants translated and its own current
  // locale as the target — see LocaleProvider.tsx's "en"/"fa" toggle from
  // #9), not a background bulk-translate of the whole conversation.
  app.post("/api/translate", async (req, res) => {
    if (!translationService.isConfigured()) {
      res.status(503).json({ error: "Translation is not configured on this server" });
      return;
    }

    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const targetLang = typeof req.body?.targetLang === "string" ? req.body.targetLang.trim() : "";
    if (!text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    if (!targetLang) {
      res.status(400).json({ error: "targetLang is required" });
      return;
    }

    const translated = await translationService.translate(text, targetLang);
    if (translated === undefined) {
      res.status(502).json({ error: "Failed to translate this message" });
      return;
    }
    res.json({ translated });
  });

  // Connect Instagram to show latest posts (#78), same shape as #77's
  // Spotify connect.
  app.post("/api/instagram/connect", async (req, res) => {
    if (!instagramService.isConfigured()) {
      res.status(503).json({ error: "Instagram integration is not configured on this server" });
      return;
    }

    const author = typeof req.body?.author === "string" ? req.body.author.trim() : "";
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const redirectUri = typeof req.body?.redirectUri === "string" ? req.body.redirectUri : "";
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    if (!code || !redirectUri) {
      res.status(400).json({ error: "code and redirectUri are required" });
      return;
    }

    const profile = await instagramService.fetchLatestPosts(code, redirectUri);
    if (!profile) {
      res.status(401).json({ error: "Failed to connect Instagram account" });
      return;
    }

    res.json({ instagramInfo: instagramInfoStore.connect(author, profile.posts) });
  });

  app.delete("/api/instagram/:author", (req, res) => {
    res.json({ instagramInfo: instagramInfoStore.disconnect(req.params.author) });
  });

  app.put("/api/instagram-info/:author", (req, res) => {
    res.json({ instagramInfo: instagramInfoStore.setHideInstagram(req.params.author, req.body?.hideInstagram === true) });
  });

  app.get("/api/instagram-info/:author", (req, res) => {
    res.json({ instagramInfo: instagramInfoStore.get(req.params.author) });
  });

  // Editable-anytime interests/lifestyle tags (#79), same
  // one-value-per-author, replace-on-update shape as this app's other
  // standalone profile fields.
  app.get("/api/interests-info/catalog", (_req, res) => {
    res.json({ interests: INTEREST_CATALOG });
  });

  app.put("/api/interests-info/:author", (req, res) => {
    const result = interestsInfoStore.update(req.params.author, req.body?.interests, req.body?.hideInterests);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ interestsInfo: result.interestsInfo });
  });

  app.get("/api/interests-info/:author", (req, res) => {
    res.json({ interestsInfo: interestsInfoStore.get(req.params.author) });
  });

  // Tinder/Hinge's "what are you up to this weekend" prompt (#119), same
  // fixed-catalog multi-select shape as #79's interests above.
  app.get("/api/weekend-plans/catalog", (_req, res) => {
    res.json({ weekendPlans: WEEKEND_PLAN_CATALOG });
  });

  app.put("/api/weekend-plans/:author", (req, res) => {
    const result = weekendPlansStore.update(req.params.author, req.body?.weekendPlans, req.body?.hideWeekendPlans);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ weekendPlansInfo: result.weekendPlansInfo });
  });

  app.get("/api/weekend-plans/:author", (req, res) => {
    res.json({ weekendPlansInfo: weekendPlansStore.get(req.params.author) });
  });

  // Feeld-style "hide specific profile sections" toggle (#80): age and
  // distance, the two core profile fields shown by default that don't
  // already have a per-field hide flag like #67-#79's optional details.
  app.put("/api/profile-visibility/:author", (req, res) => {
    const result = profileVisibilityStore.update(req.params.author, req.body?.hideAge, req.body?.hideDistance);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ visibility: result.visibility });
  });

  app.get("/api/profile-visibility/:author", (req, res) => {
    res.json({ visibility: profileVisibilityStore.get(req.params.author) });
  });

  // "Preview profile as seen by other users" (#81): composes every
  // standalone profile field (#61-#79) into the single view another user
  // would see, respecting each field's own hide flag — see profilePreview.ts.
  // Tinder Gold's real "Who's Viewed You" (#104): an optional ?viewer=
  // query records a visit whenever someone other than the profile owner
  // loads this endpoint — see profileVisits.ts. Self-previews (no viewer,
  // or viewer === author, as used by /settings/profile) are never
  // recorded as a visit.
  app.get("/api/profile-preview/:author", (req, res) => {
    const author = req.params.author;
    const viewer = typeof req.query.viewer === "string" ? req.query.viewer : "";
    if (viewer) {
      profileVisitsStore.recordVisit(viewer, author);
    }
    const preview = buildProfilePreview({
      bio: bioStore.get(author),
      jobInfo: jobInfoStore.get(author),
      educationInfo: educationInfoStore.get(author),
      heightInfo: heightInfoStore.get(author),
      lifestyleInfo: lifestyleInfoStore.get(author),
      familyPlansInfo: familyPlansInfoStore.get(author),
      zodiacInfo: zodiacInfoStore.get(author),
      languagesInfo: languagesInfoStore.get(author),
      beliefsInfo: beliefsInfoStore.get(author),
      petsInfo: petsInfoStore.get(author),
      personalityInfo: personalityInfoStore.get(author),
      spotifyInfo: spotifyInfoStore.get(author),
      instagramInfo: instagramInfoStore.get(author),
      interestsInfo: interestsInfoStore.get(author),
    });
    res.json({ preview });
  });

  // Tinder Gold's real "Who's Viewed You" (#104): who visited this
  // author's profile (via ?viewer= on the route above) within the last
  // 24 hours — see profileVisits.ts for the pruning/window rules.
  app.get("/api/profile-visitors/:author", (req, res) => {
    res.json({ visitors: profileVisitsStore.getRecentVisitors(req.params.author) });
  });

  // Editable-anytime social media links (#83), same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields.
  // Not yet folded into #81's profile-preview aggregator above.
  app.get("/api/social-links-info/platforms", (_req, res) => {
    res.json({ platforms: SOCIAL_PLATFORMS });
  });

  app.put("/api/social-links-info/:author", (req, res) => {
    const result = socialLinksInfoStore.update(req.params.author, req.body?.links, req.body?.hideSocialLinks);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ socialLinksInfo: result.socialLinksInfo });
  });

  app.get("/api/social-links-info/:author", (req, res) => {
    res.json({ socialLinksInfo: socialLinksInfoStore.get(req.params.author) });
  });

  // Editable-anytime work/travel mode (#84) — Tinder Passport/Bumble Travel
  // Mode's "I'm temporarily somewhere else" status, same one-value-per-
  // author, replace-on-update shape as this app's other standalone profile
  // fields.
  app.put("/api/travel-mode-info/:author", (req, res) => {
    const result = travelModeInfoStore.update(req.params.author, req.body?.active, req.body?.destination);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ travelModeInfo: result.travelModeInfo });
  });

  app.get("/api/travel-mode-info/:author", (req, res) => {
    res.json({ travelModeInfo: travelModeInfoStore.get(req.params.author) });
  });

  // Editable-anytime profile color theme (#85), same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields —
  // distinct from ThemeToggle.tsx's app-wide light/dark UI theme.
  app.get("/api/profile-color-theme/themes", (_req, res) => {
    res.json({ themes: PROFILE_COLOR_THEMES });
  });

  app.put("/api/profile-color-theme/:author", (req, res) => {
    const result = profileColorThemeStore.set(req.params.author, req.body?.theme);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ theme: result.theme });
  });

  app.get("/api/profile-color-theme/:author", (req, res) => {
    res.json({ theme: profileColorThemeStore.get(req.params.author) });
  });

  // "Measure profile completion percentage" (#86) — Hinge/LinkedIn's real
  // "profile strength" nudge. Reuses the same per-field getters as #81's
  // profile-preview, but asks whether a section was filled in at all, not
  // whether it's currently visible — hide flags (#67-#85) don't matter here.
  app.get("/api/profile-completion/:author", (req, res) => {
    const author = req.params.author;
    const completion = computeProfileCompletion({
      hasPhoto: photoAlbumStore.listPhotos(author).length > 0,
      bio: bioStore.get(author),
      jobInfo: jobInfoStore.get(author),
      educationInfo: educationInfoStore.get(author),
      heightInfo: heightInfoStore.get(author),
      lifestyleInfo: lifestyleInfoStore.get(author),
      familyPlansInfo: familyPlansInfoStore.get(author),
      zodiacInfo: zodiacInfoStore.get(author),
      languagesInfo: languagesInfoStore.get(author),
      beliefsInfo: beliefsInfoStore.get(author),
      petsInfo: petsInfoStore.get(author),
      personalityInfo: personalityInfoStore.get(author),
      interestsInfo: interestsInfoStore.get(author),
      promptAnswerCount: profilePromptsStore.getAnswers(author).length,
    });
    res.json({ completion });
  });

  // Editable-anytime "official achievements" list (#87) — degrees,
  // certifications, awards, same one-value-per-author, replace-on-update
  // shape as this app's other standalone profile fields. See
  // achievementsInfo.ts for why resume-document upload is out of scope.
  app.put("/api/achievements-info/:author", (req, res) => {
    const result = achievementsInfoStore.update(req.params.author, req.body?.achievements, req.body?.hideAchievements);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ achievementsInfo: result.achievementsInfo });
  });

  app.get("/api/achievements-info/:author", (req, res) => {
    res.json({ achievementsInfo: achievementsInfoStore.get(req.params.author) });
  });

  // Editable-anytime display-name mode (#88) — how #21's onboarding name is
  // actually rendered to other users, same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields.
  app.get("/api/display-name-mode/modes", (_req, res) => {
    res.json({ modes: DISPLAY_NAME_MODES });
  });

  app.put("/api/display-name-mode/:author", (req, res) => {
    const result = displayNameModeStore.update(req.params.author, req.body?.mode, req.body?.nickname);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ preference: result.preference });
  });

  app.get("/api/display-name-mode/:author", (req, res) => {
    res.json({ preference: displayNameModeStore.get(req.params.author) });
  });

  // Stylized (3D/cartoon) avatar selection (#89), same one-value-per-author,
  // replace-on-update shape as this app's other standalone profile fields —
  // see stylizedAvatar.ts for why this is a fixed preset catalog rather
  // than real 3D rendering.
  app.get("/api/stylized-avatar/styles", (_req, res) => {
    res.json({ styles: AVATAR_STYLES });
  });

  app.put("/api/stylized-avatar/:author", (req, res) => {
    const result = stylizedAvatarStore.update(req.params.author, req.body?.style, req.body?.active);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ stylizedAvatarInfo: result.stylizedAvatarInfo });
  });

  app.get("/api/stylized-avatar/:author", (req, res) => {
    res.json({ stylizedAvatarInfo: stylizedAvatarStore.get(req.params.author) });
  });

  // Tinder's swipe-card interface (#91): opt-in candidate pool, a
  // like/pass decision on each candidate, and mutual-like match
  // detection. See swipes.ts for what's deliberately out of scope
  // (a Kafka/Redis-backed recommendation service, native gesture layer).
  app.post("/api/discovery/join", (req, res) => {
    const result = swipeStore.joinDiscovery(req.body?.author);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ success: true });
  });

  app.delete("/api/discovery/join/:author", (req, res) => {
    swipeStore.leaveDiscovery(req.params.author);
    res.status(204).send();
  });

  // Shared by every route that must never surface a blocked author to the
  // other side — discovery, top picks, and #103's liked-you list all read
  // this, so the block relationship stays enforced everywhere a candidate
  // could otherwise appear.
  const isBlockedEitherWay = (a: string, b: string) =>
    blockStore.getBlockedAuthors(a).includes(b) || blockStore.getBlockedAuthors(b).includes(a);

  // OkCupid's real advanced discovery filters (#96, extended by #97 with
  // non-smoking/lifestyle and #98 with verified-only): a candidate who
  // fails the swiper's own filters is excluded the same way a blocked
  // candidate is — see discoveryFilters.ts for why this reads raw profile
  // data regardless of the candidate's own hide flags, and for the
  // documented gap between guest "author" identities and the
  // verifiedOnly signal's real-account VerificationStore. Shared between
  // /api/swipe-candidates and #101's /api/top-picks, which both draw from
  // the same eligible-candidate pool. #103's liked-you list deliberately
  // does NOT apply these — a discovery filter narrows who you go looking
  // for, it shouldn't hide someone who already expressed interest in you
  // — so it only reuses the block check above.
  const isExcludedCandidate = (a: string, b: string) => {
    if (isBlockedEitherWay(a, b)) {
      return true;
    }
    // Bumble's real "remove spam and fake profiles from the like queue"
    // (#107): a candidate flagged by fakeProfileDetector.ts's heuristic
    // scan (report threshold + spam-bio pattern match) never reaches the
    // like queue at all — see that file for why these two signals rather
    // than an invented model.
    const fakeProfileScan = scanCandidateForFakeProfile({
      bio: bioStore.get(b),
      reportCount: reportStore.countFor(b),
    });
    if (fakeProfileScan.flagged) {
      return true;
    }
    const filters = discoveryFiltersStore.get(a);
    const candidateLifestyle = lifestyleInfoStore.get(b);
    const candidateData = {
      heightCm: heightInfoStore.get(b).heightCm,
      hasEducation: educationInfoStore.get(b).school !== "",
      languages: languagesInfoStore.get(b).languages,
      smoking: candidateLifestyle.smoking,
      drinking: candidateLifestyle.drinking,
      isVerified: verificationStore.isVerified(b),
    };
    if (!candidateMatchesFilters(filters, candidateData)) {
      return true;
    }
    // Tinder's real Explore Mode (#99): when the swiper has a themed deck
    // active (cafes/sports/travel), only candidates sharing at least one
    // of that theme's interest tags are shown.
    const exploreMode = exploreModeStore.get(a);
    if (!candidateMatchesExploreMode(exploreMode, interestsInfoStore.get(b).interests)) {
      return true;
    }
    // Bumble's real Incognito Mode (#111): a candidate with vanish mode on
    // is hidden from everyone except someone they've already liked or
    // superliked themselves — see vanishMode.ts for why that specific
    // exception rather than a blanket hide.
    if (vanishModeStore.isEnabled(b) && !swipeStore.hasLiked(b, a)) {
      return true;
    }
    return false;
  };
  // OkCupid's real percentage-match algorithm (#94), computed from #79's
  // interest tags — see interestCompatibility.ts for why interests rather
  // than a full questionnaire.
  const getCandidateCompatibility = (a: string, b: string) =>
    computeInterestCompatibility(interestsInfoStore.get(a).interests, interestsInfoStore.get(b).interests);
  // Tinder's real Boost/Super Boost (#105, #106): a higher boost level
  // ranks ahead of a lower one and both rank ahead of everyone except
  // someone who's superliked this viewer — see swipes.ts's getCandidates
  // doc comment for the exact priority order.
  const getCandidateBoostLevel = (candidate: string) => profileBoostStore.getBoostLevel(candidate);

  // OkCupid/Tinder's real bio keyword search (#113): an optional ?bioKeyword=
  // query narrows the same eligible pool everything else above filters,
  // rather than a separate search endpoint or a persisted preference (see
  // discoveryFilters.ts for the contrast) — it's a one-off query, not a
  // standing filter the swiper wants applied to every future session.
  app.get("/api/swipe-candidates/:author", (req, res) => {
    const bioKeyword = typeof req.query.bioKeyword === "string" ? req.query.bioKeyword : "";
    const excludeCandidate = bioKeyword
      ? (a: string, b: string) => isExcludedCandidate(a, b) || !bioMatchesKeyword(bioStore.get(b), bioKeyword)
      : isExcludedCandidate;
    res.json({
      candidates: swipeStore.getCandidates(req.params.author, excludeCandidate, getCandidateCompatibility, getCandidateBoostLevel),
    });
  });

  // Tinder's real Boost/Super Boost (#105, #106): free here since this
  // app has no premium tier to gate it behind, same call as #92's free
  // Rewind. tier defaults to "boost" when omitted.
  app.post("/api/profile-boost/:author", (req, res) => {
    const result = profileBoostStore.activateBoost(req.params.author, req.body?.tier);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ tier: result.tier, expiresAt: result.expiresAt });
  });

  app.get("/api/profile-boost/:author", (req, res) => {
    res.json(profileBoostStore.getStatus(req.params.author));
  });

  // #106's "smart" half of Super Boost: the hours (UTC) with the most
  // real swipe activity, plus whether right now is one of them — a hint
  // for when boosting will actually reach the most people, rather than
  // leaving the user to guess. See peakHours.ts for the honesty note on
  // what this is (and isn't) modeling.
  app.get("/api/peak-hours", (_req, res) => {
    res.json(peakHoursStore.getStatus());
  });

  // Tinder's real "Likes You" (#103): free here since this app has no
  // premium tier to gate it behind — see swipes.ts for why it only
  // applies the block check, not the swiper's own discovery filters.
  app.get("/api/liked-you/:author", (req, res) => {
    res.json({
      likedBy: swipeStore.getLikedBy(req.params.author, isBlockedEitherWay, getCandidateCompatibility),
    });
  });

  // Tinder's real "Top Picks" (#101): a small, once-per-day curated list
  // drawn from the same eligible pool as /api/swipe-candidates, ranked by
  // #95's real Elo/Smart Score desirability rating — Tinder's own Top
  // Picks is documented as powered by that same signal, so this reuses it
  // rather than inventing a separate "quality" score. See topPicks.ts for
  // the once-a-day caching.
  app.get("/api/top-picks/:author", (req, res) => {
    const author = req.params.author;
    const pool = swipeStore
      .getCandidates(author, isExcludedCandidate, getCandidateCompatibility, getCandidateBoostLevel, TOP_PICKS_POOL_SIZE)
      .map((c) => c.author);
    const picks = topPicksStore.getTopPicks(author, pool, (candidate) => smartScoreStore.getRating(candidate));
    res.json({ picks });
  });

  // Tinder's real (now-discontinued) "Crossed Paths" (#108): candidates
  // from the same eligible pool as /api/swipe-candidates whose recent
  // real-world location trail physically overlapped with this author's
  // — see crossedPaths.ts for the ping/threshold/window rules and the
  // honest limitation on what "recent" means without background tracking.
  app.get("/api/crossed-paths/:author", (req, res) => {
    const author = req.params.author;
    const pool = swipeStore
      .getCandidates(author, isExcludedCandidate, getCandidateCompatibility, getCandidateBoostLevel, TOP_PICKS_POOL_SIZE)
      .map((c) => c.author);
    const crossedAuthors = crossedPathsStore.getCrossedAuthors(author, pool);
    res.json({
      crossedPaths: crossedAuthors.map((candidate) => ({
        author: candidate,
        compatibility: getCandidateCompatibility(author, candidate),
      })),
    });
  });

  // Tinder's real Facebook-friends "mutual friends" signal (#114), built
  // on #17's phone-contact hashing instead — see contactsGraph.ts. An
  // author uploads their phone contacts once; POST replaces (not merges)
  // their previous list, same "resubmit the current state" semantics as
  // #17's own contact-block upload.
  app.post("/api/contact-graph/:author", (req, res) => {
    const result = contactsGraphStore.uploadContacts(req.params.author, req.body?.phoneNumbers);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ contactCount: result.contactCount });
  });

  // Candidates from the same eligible pool as /api/swipe-candidates who
  // share at least one contact with this author — the actual "matching
  // based on shared contacts" this issue asks for, same drawn-from-the-
  // same-pool shape as #108's Crossed Paths above.
  app.get("/api/shared-contacts/:author", (req, res) => {
    const author = req.params.author;
    const pool = swipeStore
      .getCandidates(author, isExcludedCandidate, getCandidateCompatibility, getCandidateBoostLevel, TOP_PICKS_POOL_SIZE)
      .map((c) => c.author);
    const withSharedContacts = pool
      .map((candidate) => ({ author: candidate, sharedContacts: contactsGraphStore.getSharedContactCount(author, candidate) }))
      .filter((entry) => entry.sharedContacts > 0)
      .sort((a, b) => b.sharedContacts - a.sharedContacts);
    res.json({ candidates: withSharedContacts });
  });

  // Hinge's real "you both like X" shared-interest framing (#118) applied
  // to #77's Spotify top tracks — same drawn-from-the-same-pool shape as
  // #108/#114 above. Respects #77's own hideSpotify flag on both sides
  // (a candidate hiding their Spotify info shouldn't have it surfaced
  // here either) and requires both accounts actually connected.
  app.get("/api/music-matches/:author", (req, res) => {
    const author = req.params.author;
    const authorSpotify = spotifyInfoStore.get(author);
    if (!authorSpotify.connected || authorSpotify.hideSpotify) {
      res.json({ candidates: [] });
      return;
    }
    const pool = swipeStore
      .getCandidates(author, isExcludedCandidate, getCandidateCompatibility, getCandidateBoostLevel, TOP_PICKS_POOL_SIZE)
      .map((c) => c.author);
    const musicMatches = pool
      .map((candidate) => {
        const candidateSpotify = spotifyInfoStore.get(candidate);
        if (!candidateSpotify.connected || candidateSpotify.hideSpotify) return null;
        const match = computeMusicMatch(authorSpotify.topTracks, candidateSpotify.topTracks);
        return match.sharedTracks.length > 0 ? { author: candidate, ...match } : null;
      })
      .filter((entry): entry is { author: string; sharedTracks: string[]; compatibility: number } => entry !== null)
      .sort((a, b) => b.sharedTracks.length - a.sharedTracks.length);
    res.json({ candidates: musicMatches });
  });

  // Tinder/Hinge's "what are you up to this weekend" suggestion (#119) —
  // same shape as #118's music matches above, applied to #119's weekend-
  // plan tags instead of Spotify top tracks. Respects hideWeekendPlans on
  // both sides.
  app.get("/api/weekend-plan-matches/:author", (req, res) => {
    const author = req.params.author;
    const authorPlans = weekendPlansStore.get(author);
    if (authorPlans.hideWeekendPlans || authorPlans.weekendPlans.length === 0) {
      res.json({ candidates: [] });
      return;
    }
    const pool = swipeStore
      .getCandidates(author, isExcludedCandidate, getCandidateCompatibility, getCandidateBoostLevel, TOP_PICKS_POOL_SIZE)
      .map((c) => c.author);
    const planMatches = pool
      .map((candidate) => {
        const candidatePlans = weekendPlansStore.get(candidate);
        if (candidatePlans.hideWeekendPlans) return null;
        const match = computeWeekendPlanMatch(authorPlans.weekendPlans, candidatePlans.weekendPlans);
        return match.sharedPlans.length > 0 ? { author: candidate, ...match } : null;
      })
      .filter((entry): entry is { author: string; sharedPlans: string[]; compatibility: number } => entry !== null)
      .sort((a, b) => b.sharedPlans.length - a.sharedPlans.length);
    res.json({ candidates: planMatches });
  });

  // "Use AI to analyze bio text and improve matching" (#120) — an honest
  // keyword-extraction heuristic over #65's bio field rather than an
  // invented LLM/NLP integration this app has no model or inference
  // infrastructure for; see bioAnalysis.ts's doc comment for why, same
  // scoping call as #95's Elo-style Smart Score and #107's fake-profile
  // heuristic. Same drawn-from-the-same-pool shape as #118/#119 above.
  app.get("/api/bio-matches/:author", (req, res) => {
    const author = req.params.author;
    const authorBio = bioStore.get(author);
    if (!authorBio) {
      res.json({ candidates: [] });
      return;
    }
    const pool = swipeStore
      .getCandidates(author, isExcludedCandidate, getCandidateCompatibility, getCandidateBoostLevel, TOP_PICKS_POOL_SIZE)
      .map((c) => c.author);
    const bioMatches = pool
      .map((candidate) => {
        const match = computeBioMatch(authorBio, bioStore.get(candidate));
        return match.sharedKeywords.length > 0 ? { author: candidate, ...match } : null;
      })
      .filter((entry): entry is { author: string; sharedKeywords: string[]; compatibility: number } => entry !== null)
      .sort((a, b) => b.sharedKeywords.length - a.sharedKeywords.length);
    res.json({ candidates: bioMatches });
  });

  // Hinge's real "AI-suggested conversation starters" (#132) — genuinely
  // personalized from this app's real shared-signal computations (#94's
  // interest overlap, #118's music match, #119's weekend-plan match,
  // #120's bio keyword match) rather than an invented LLM call this app
  // has no model or API key for; see icebreakers.ts. Respects each
  // signal's own hide flag on both sides, same as their standalone match
  // endpoints above.
  app.get("/api/icebreakers/:author/:candidate", (req, res) => {
    const { author, candidate } = req.params;

    const authorInterests = interestsInfoStore.get(author);
    const candidateInterests = interestsInfoStore.get(candidate);
    const sharedInterests =
      !authorInterests.hideInterests && !candidateInterests.hideInterests
        ? authorInterests.interests.filter((interest) => candidateInterests.interests.includes(interest))
        : [];

    const authorSpotify = spotifyInfoStore.get(author);
    const candidateSpotify = spotifyInfoStore.get(candidate);
    const musicTracks =
      authorSpotify.connected && !authorSpotify.hideSpotify && candidateSpotify.connected && !candidateSpotify.hideSpotify
        ? computeMusicMatch(authorSpotify.topTracks, candidateSpotify.topTracks).sharedTracks
        : [];

    const authorPlans = weekendPlansStore.get(author);
    const candidatePlans = weekendPlansStore.get(candidate);
    const weekendPlans =
      !authorPlans.hideWeekendPlans && !candidatePlans.hideWeekendPlans
        ? computeWeekendPlanMatch(authorPlans.weekendPlans, candidatePlans.weekendPlans).sharedPlans
        : [];

    const bioKeywords = computeBioMatch(bioStore.get(author), bioStore.get(candidate)).sharedKeywords;

    const suggestions = generateIcebreakers({ interests: sharedInterests, musicTracks, weekendPlans, bioKeywords });
    res.json({ suggestions });
  });

  // Match.com/Tinder's real "Double Date" (#109): a small group of
  // friends (2-4) teams up as one squad and swipes on other squads
  // together — see squads.ts for why a mutual like reuses this app's
  // existing multi-room chat instead of a separate group-chat system.
  app.post("/api/squads", (req, res) => {
    const result = squadStore.createSquad(req.body?.members);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ squad: result.squad });
  });

  app.get("/api/squads/:author", (req, res) => {
    res.json({ squad: squadStore.getSquadForAuthor(req.params.author) });
  });

  app.delete("/api/squads/:squadId", (req, res) => {
    const result = squadStore.disbandSquad(req.params.squadId, req.body?.author);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(204).send();
  });

  app.post("/api/squads/:squadId/discovery", (req, res) => {
    const result = squadStore.joinDiscovery(req.params.squadId);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ success: true });
  });

  app.delete("/api/squads/:squadId/discovery", (req, res) => {
    squadStore.leaveDiscovery(req.params.squadId);
    res.status(204).send();
  });

  app.get("/api/squad-candidates/:squadId", (req, res) => {
    res.json({ candidates: squadStore.getCandidates(req.params.squadId) });
  });

  app.post("/api/squad-swipes", (req, res) => {
    const result = squadStore.recordSwipe(req.body?.swiperSquadId, req.body?.swipedSquadId, req.body?.direction);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ matched: result.matched, roomId: result.roomId });
  });

  app.get("/api/squad-matches/:squadId", (req, res) => {
    res.json({ matches: squadStore.getGroupMatches(req.params.squadId) });
  });

  // Badoo's real online/last-active indicator (#110): "online" is driven
  // live by the presence:online/disconnect socket handlers below; this
  // endpoint just exposes the current snapshot for profile views that
  // aren't already holding a socket connection to that author.
  app.get("/api/presence/:author", (req, res) => {
    res.json(presenceStore.getStatus(req.params.author));
  });

  // Bumble's real Incognito Mode (#111): see vanishMode.ts and
  // isExcludedCandidate above for the actual hide-from-discovery behavior
  // this toggle drives.
  app.put("/api/vanish-mode/:author", (req, res) => {
    const result = vanishModeStore.setEnabled(req.params.author, req.body?.enabled);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ enabled: result.enabled });
  });

  app.get("/api/vanish-mode/:author", (req, res) => {
    res.json({ enabled: vanishModeStore.isEnabled(req.params.author) });
  });

  // Hinge's real "like or comment on one specific photo" (#112): gated the
  // same way #45's photo serve is (block check + #59's album access level)
  // plus confirming photoId is actually in owner's album, ahead of
  // photoInteractions.ts's own validation.
  const canInteractWithPhoto = (actor: string, owner: string, photoId: string): string | null => {
    if (isBlockedEitherWay(actor, owner)) return "Cannot interact with this author's photos";
    if (!photoAlbumStore.canView(actor, owner)) return "This album isn't public — request access from its owner";
    if (!photoAlbumStore.listPhotos(owner).includes(photoId)) return "Photo not found in that owner's album";
    return null;
  };

  app.post("/api/photo-likes/:owner/:photoId", (req, res) => {
    const liker = typeof req.body?.liker === "string" ? req.body.liker.trim() : "";
    const blockedReason = canInteractWithPhoto(liker, req.params.owner, req.params.photoId);
    if (blockedReason) {
      res.status(403).json({ error: blockedReason });
      return;
    }
    const result = photoInteractionStore.toggleLike(liker, req.params.owner, req.params.photoId);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ liked: result.liked, likeCount: photoInteractionStore.getLikeCount(req.params.owner, req.params.photoId) });
  });

  app.get("/api/photo-likes/:owner/:photoId", (req, res) => {
    const viewer = typeof req.query.viewer === "string" ? req.query.viewer.trim() : "";
    res.json({
      likeCount: photoInteractionStore.getLikeCount(req.params.owner, req.params.photoId),
      liked: viewer ? photoInteractionStore.hasLiked(viewer, req.params.owner, req.params.photoId) : false,
    });
  });

  app.post("/api/photo-notes/:owner/:photoId", (req, res) => {
    const sender = typeof req.body?.sender === "string" ? req.body.sender.trim() : "";
    const blockedReason = canInteractWithPhoto(sender, req.params.owner, req.params.photoId);
    if (blockedReason) {
      res.status(403).json({ error: blockedReason });
      return;
    }
    const result = photoInteractionStore.sendNote(sender, req.params.owner, req.params.photoId, req.body?.text);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ note: result.note });
  });

  app.get("/api/photo-notes/:owner/:photoId", (req, res) => {
    res.json({ notes: photoInteractionStore.getNotes(req.params.owner, req.params.photoId) });
  });

  // Tinder's real Explore Mode (#99): a curated themed deck (cafes/sports/
  // travel) instead of the normal, unfiltered discovery deck.
  app.get("/api/explore-mode/catalog", (_req, res) => {
    res.json({ modes: EXPLORE_MODES });
  });

  app.put("/api/explore-mode/:author", (req, res) => {
    const result = exploreModeStore.update(req.params.author, req.body?.mode);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ mode: result.mode });
  });

  app.get("/api/explore-mode/:author", (req, res) => {
    res.json({ mode: exploreModeStore.get(req.params.author) });
  });

  // OkCupid's real DoubleTake-style grid browsing as a web-native
  // alternative to the one-at-a-time swipe deck (#115) — a persisted
  // display preference, same shape as #99's explore mode above.
  app.put("/api/view-mode/:author", (req, res) => {
    const result = viewModeStore.set(req.params.author, req.body?.mode);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ mode: result.mode });
  });

  app.get("/api/view-mode/:author", (req, res) => {
    res.json({ mode: viewModeStore.get(req.params.author) });
  });

  // OkCupid's advanced discovery filters (#96, extended by #97 and #98):
  // height range, education requirement, required languages, non-smoking,
  // allowed drinking, and verified-only — narrows /api/swipe-candidates.
  app.put("/api/discovery-filters/:author", (req, res) => {
    const result = discoveryFiltersStore.update(
      req.params.author,
      req.body?.minHeightCm,
      req.body?.maxHeightCm,
      req.body?.requireEducation,
      req.body?.requiredLanguages,
      req.body?.requireNonSmoking,
      req.body?.allowedDrinking,
      req.body?.requireVerifiedOnly
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ filters: result.filters });
  });

  app.get("/api/discovery-filters/:author", (req, res) => {
    res.json({ filters: discoveryFiltersStore.get(req.params.author) });
  });

  app.post("/api/swipes", (req, res) => {
    const result = swipeStore.recordSwipe(req.body?.swiper, req.body?.swiped, req.body?.direction);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    // Tinder's real "Elo Score"/"Smart Score" (#95): every swipe outcome
    // feeds the swiped author's desirability rating and the swiper's own
    // activity count — see smartScore.ts.
    const liked = req.body?.direction === "like" || req.body?.direction === "superlike";
    const swiperName = typeof req.body?.swiper === "string" ? req.body.swiper.trim() : "";
    const swipedName = typeof req.body?.swiped === "string" ? req.body.swiped.trim() : "";
    smartScoreStore.recordSwipeOutcome(swiperName, swipedName, liked);
    // #106's "peak network hours": each swipe counts as one unit of
    // real network activity for the hour it happened in — see
    // peakHours.ts.
    peakHoursStore.recordActivity();
    // Bumble's real 24-hour match-expiry timer (#136) starts ticking the
    // moment a match is created — see matchExpiry.ts.
    if (result.matched) {
      matchExpiryStore.recordMatch(swiperName, swipedName);
    }
    res.status(201).json({ matched: result.matched });
  });

  // OkCupid's mutual compatibility percentage (#100), shown persistently
  // once matched rather than only during swiping (#94's transient
  // swipe-card badge) — same computeInterestCompatibility score, computed
  // per match at the route level like #94's swipe-candidates route.
  app.get("/api/matches/:author", (req, res) => {
    const author = req.params.author;
    const includeArchived = req.query.includeArchived === "true";
    // Bumble's real 24-hour match-expiry timer (#136): an expired match
    // (nobody said anything within the window) drops off the list, same
    // as real Bumble removing it from your matches. Bumble's real
    // "Archive old chats" (#139): archived matches are hidden from the
    // default list too, unless the caller explicitly asks to see them
    // (e.g. a dedicated "Archived" view).
    const matches = swipeStore
      .getMatches(author)
      .filter((matchedAuthor) => !matchExpiryStore.isExpired(author, matchedAuthor))
      .filter((matchedAuthor) => includeArchived || !archivedChatsStore.isArchived(author, matchedAuthor))
      .map((matchedAuthor) => ({
        author: matchedAuthor,
        compatibility: computeInterestCompatibility(
          interestsInfoStore.get(author).interests,
          interestsInfoStore.get(matchedAuthor).interests
        ),
        archived: archivedChatsStore.isArchived(author, matchedAuthor),
      }));
    res.json({ matches });
  });

  // Bumble's real "Unmatch" (#141), unmatching and deleting the chat in a
  // single call rather than two separate steps. Clears this pair's pin
  // (#138) and archive (#139) list-state on both sides too, so the match
  // disappears from both viewers' lists immediately rather than lingering
  // as a pinned/archived ghost entry — see swipes.ts's unmatch doc comment
  // for why there's no separate message thread to purge in this app's
  // current single-shared-room scope.
  app.delete("/api/matches/:author/:candidate", (req, res) => {
    const { author, candidate } = req.params;
    const result = swipeStore.unmatch(author, candidate);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    pinnedChatsStore.unpin(author, candidate);
    pinnedChatsStore.unpin(candidate, author);
    archivedChatsStore.unarchive(author, candidate);
    archivedChatsStore.unarchive(candidate, author);
    res.json({ success: true });
  });

  // Bumble's real "24-hour timer to respond to the first message before
  // the Match expires" (#136) — lets the client render a live countdown
  // rather than only finding out a match is gone once it disappears.
  app.get("/api/matches/:author/:candidate/expiry", (req, res) => {
    const { author, candidate } = req.params;
    const state = matchExpiryStore.getState(author, candidate);
    if (!state) {
      res.status(404).json({ error: "No tracked match between these two authors" });
      return;
    }
    const expiresAt = new Date(new Date(state.matchedAt).getTime() + MATCH_RESPONSE_WINDOW_MS).toISOString();
    res.json({
      matchedAt: state.matchedAt,
      firstMessageSentAt: state.firstMessageSentAt ?? null,
      expiresAt,
      expired: matchExpiryStore.isExpired(author, candidate),
      extended: state.extended ?? false,
    });
  });

  // Bumble's real "Extend" (#137) — either side can push the 24-hour
  // deadline back by another 24 hours, once per match, before it expires.
  app.post("/api/matches/:author/:candidate/extend", (req, res) => {
    const { author, candidate } = req.params;
    const result = matchExpiryStore.extend(author, candidate);
    if (!result.allowed) {
      res.status(400).json({ error: result.error });
      return;
    }
    const state = matchExpiryStore.getState(author, candidate)!;
    const expiresAt = new Date(new Date(state.matchedAt).getTime() + MATCH_RESPONSE_WINDOW_MS).toISOString();
    res.json({ expiresAt, extended: true });
  });

  // Tinder's "Rewind" feature (#92): undo only the single most recent
  // swipe, re-opening that candidate and revoking the match if that swipe
  // had just created one.
  app.post("/api/swipes/undo", (req, res) => {
    const result = swipeStore.undoLastSwipe(req.body?.author);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ swiped: result.swiped });
  });

  // Tinder's Super Like (#93): shows special attention by counting toward
  // a match same as an ordinary like, but rate-limited per day.
  app.get("/api/super-likes-remaining/:author", (req, res) => {
    res.json({ remaining: swipeStore.getSuperLikesRemainingToday(req.params.author) });
  });

  // Coffee Meets Bagel/Tinder's real free-tier daily like limit (#116) —
  // see swipes.ts's DAILY_LIKE_LIMIT; this app has no premium tier to sell
  // an unlimited-likes upgrade behind, so the cap is just the free
  // allowance with no paid bypass, same scoping call as every other
  // paywalled-upstream feature in this backlog.
  app.get("/api/likes-remaining/:author", (req, res) => {
    res.json({ remaining: swipeStore.getLikesRemainingToday(req.params.author) });
  });

  // Tinder's "Elo Score"/"Smart Score" (#95): a desirability rating built
  // from swipe outcomes, plus a separate activity count — see
  // smartScore.ts for why they're not blended into one number.
  app.get("/api/smart-score/:author", (req, res) => {
    res.json({ score: smartScoreStore.getScore(req.params.author) });
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

  // Bumble's real "Search within conversation text" (#140) — same
  // mutual-block filtering as the plain messages list above, then a
  // case-insensitive substring match over each message's text.
  app.get("/api/rooms/:roomId/messages/search", (req, res) => {
    const { roomId } = req.params;
    const viewer = typeof req.query.viewer === "string" ? req.query.viewer : undefined;
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const unfiltered = messagesByRoom.get(roomId) ?? [];
    const all = viewer ? unfiltered.filter((m) => !blockStore.isMutuallyBlocked(viewer, m.author)) : unfiltered;
    res.json({ results: searchMessages(all, query) });
  });

  // Bumble's real sent/delivered/read message status (#125) — a REST
  // snapshot of the same status the message:status socket event pushes
  // live, for a surface that isn't already holding a socket connection
  // (or to check a historical message's status without waiting for a
  // live update). See readReceipts.ts for the aggregate-status shape.
  app.get("/api/rooms/:roomId/messages/:messageId/status", (req, res) => {
    const message = messagesByRoom.get(req.params.roomId)?.find((m) => m.id === req.params.messageId);
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    res.json({ status: readReceiptStore.getStatus(message.id, message.author) });
  });

  // Bumble's real typing indicator (#126) — a REST snapshot of the same
  // state the typing:update socket event pushes live, for a surface that
  // isn't already holding a socket connection.
  app.get("/api/rooms/:roomId/typing", (req, res) => {
    res.json({ authors: typingStore.getTypingAuthors(req.params.roomId) });
  });

  // WhatsApp/Bumble's real "share live location" (#127) — a REST snapshot
  // of the current in-progress position for a client that (re)loaded the
  // page after the share started and missed earlier location:update
  // broadcasts; see liveLocationShares.ts.
  app.get("/api/rooms/:roomId/messages/:messageId/location", (req, res) => {
    const share = liveLocationShareStore.get(req.params.messageId);
    if (!share) {
      res.status(404).json({ error: "No live location share for this message" });
      return;
    }
    res.json({
      latitude: share.latitude,
      longitude: share.longitude,
      expiresAt: share.expiresAt,
      active: liveLocationShareStore.isActive(req.params.messageId),
    });
  });

  // Badoo's real in-app audio call (#128) — a REST snapshot of an
  // in-progress call/whether an author is currently busy, for a surface
  // that isn't already holding a socket connection. See calls.ts for the
  // actual signaling state machine.
  app.get("/api/calls/:callId", (req, res) => {
    const call = callStore.get(req.params.callId);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    res.json({ call });
  });

  app.get("/api/calls/active/:author", (req, res) => {
    res.json({ call: callStore.getActiveCallFor(req.params.author) ?? null });
  });

  // Bumble's real "mandatory text-first" video-call gate (#130) — lets the
  // client show/disable the video-call button (and how many more messages
  // are needed) ahead of time, rather than only finding out after the
  // call is rejected. See videoCallGate.ts; #128's audio call has no such
  // gate and isn't checked here.
  app.get("/api/rooms/:roomId/video-call-eligibility", (req, res) => {
    const caller = typeof req.query.caller === "string" ? req.query.caller : "";
    const callee = typeof req.query.callee === "string" ? req.query.callee : "";
    if (!caller || !callee) {
      res.status(400).json({ error: "caller and callee are required" });
      return;
    }
    const roomMessages = messagesByRoom.get(req.params.roomId) ?? [];
    res.json(checkVideoCallEligibility(roomMessages, caller, callee));
  });

  // Badoo's real beauty filter/background blur during video calls (#131)
  // — a persisted preference; the actual pixel processing happens
  // entirely client-side when a call starts, see videoCallEffects.ts.
  app.put("/api/video-call-effects/:author", (req, res) => {
    const result = videoCallEffectsStore.update(req.params.author, req.body?.beautyFilter, req.body?.backgroundBlur);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ effects: result.effects });
  });

  app.get("/api/video-call-effects/:author", (req, res) => {
    res.json({ effects: videoCallEffectsStore.get(req.params.author) });
  });

  // Bumble's real "women message first" rule (#135) — a declared gender
  // per chat author, used only to enforce that rule on a fresh match's
  // opening message; see genderInfo.ts and message:send below.
  app.put("/api/gender-info/:author", (req, res) => {
    const result = genderInfoStore.set(req.params.author, req.body?.gender);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ gender: result.gender });
  });

  app.get("/api/gender-info/:author", (req, res) => {
    res.json({ gender: genderInfoStore.get(req.params.author) ?? null });
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
    // Tinder's real "Crossed Paths" (#108): each location update is also
    // recorded as one ping in this author's recent-location trail — see
    // crossedPaths.ts for why a ping rather than continuous tracking.
    crossedPathsStore.recordPing(author, req.body);
    res.json({ approximate: locations.getApproximateLocation(author) });
  });

  // Tinder's real Passport (#102) means this now returns the active
  // Passport override when one is set, not just the real GPS location —
  // see locationPrivacy.ts for why this is the one method discovery
  // logic should read.
  app.get("/api/users/:author/location", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    const approximate = locations.getEffectiveLocation(author);
    if (!approximate) {
      res.status(404).json({ error: "no location on file for this user" });
      return;
    }
    res.json({ approximate });
  });

  // Tinder's real Passport (#102): manually set discovery location to a
  // different city, overriding the real GPS location above until
  // cleared — distinct from #84's TravelModeInfo, which is only a
  // cosmetic profile badge with no effect on actual discovery location.
  app.put("/api/users/:author/passport-location", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    const result = locations.setPassportLocation(author, req.body?.cityName, req.body?.coordinates);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ passportLocation: result.location });
  });

  app.delete("/api/users/:author/passport-location", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    locations.clearPassportLocation(author);
    res.status(204).send();
  });

  app.get("/api/users/:author/passport-location", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    res.json({ active: locations.isPassportActive(author), cityName: locations.getPassportCityName(author) });
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

  // Badoo's real voice-note chat messages with a waveform (#122) — same
  // upload-then-reference shape as /api/uploads above, but its own store
  // (see voiceNotes.ts) since a chat voice note also carries a waveform,
  // which an image upload doesn't. The waveform is computed client-side
  // (this server has no audio-decoding capability) and only validated/
  // bounded here before being echoed back for the client to attach to its
  // message:send payload.
  app.post("/api/voice-notes", (req, res) => {
    const { mimeType, data, waveform } = req.body ?? {};
    const result = voiceNoteStore.save(mimeType, data, waveform);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ url: `/api/voice-notes/${result.id}`, waveform: result.waveform });
  });

  app.get("/api/voice-notes/:id", (req, res) => {
    const note = voiceNoteStore.get(req.params.id);
    if (!note) {
      res.status(404).end();
      return;
    }
    res.set("Content-Type", note.mimeType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(note.data);
  });

  // Bumble/Snapchat-style "view once, then gone" chat photo (#123) — see
  // selfDestructPhotos.ts. Never cacheable (each GET can be the one that
  // destroys it), unlike /api/uploads and /api/voice-notes above.
  app.post("/api/self-destruct-photos", (req, res) => {
    const { author, mimeType, data } = req.body ?? {};
    const result = selfDestructPhotoStore.save(author, mimeType, data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ url: `/api/self-destruct-photos/${result.id}` });
  });

  app.get("/api/self-destruct-photos/:id", (req, res) => {
    const viewer = typeof req.query.viewer === "string" ? req.query.viewer.trim() : "";
    if (!viewer) {
      res.status(400).json({ error: "viewer is required" });
      return;
    }
    const photo = selfDestructPhotoStore.view(req.params.id, viewer);
    if (!photo) {
      res.status(selfDestructPhotoStore.hasBeenViewed(req.params.id) ? 410 : 404).json({
        error: selfDestructPhotoStore.hasBeenViewed(req.params.id) ? "This photo has already disappeared" : "Photo not found",
      });
      return;
    }
    res.set("Content-Type", photo.mimeType);
    res.set("Cache-Control", "no-store");
    res.send(photo.data);
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
    const deviceLabel = describeUserAgent(req.get("user-agent"));
    const tokens = tokenService.issueTokens(user.id, deviceLabel);
    smsSecurityAlertStore.notify(user.id, user.phoneNumber, "login", `New sign-in to your ChatApp account from ${deviceLabel}.`);
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
    const deviceLabel = describeUserAgent(req.get("user-agent"));
    const tokens = tokenService.issueTokens(user.id, deviceLabel);
    smsSecurityAlertStore.notify(user.id, user.phoneNumber, "login", `New sign-in to your ChatApp account from ${deviceLabel}.`);
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
    const deviceLabel = describeUserAgent(req.get("user-agent"));
    const tokens = tokenService.issueTokens(user.id, deviceLabel);
    smsSecurityAlertStore.notify(user.id, user.phoneNumber, "login", `New sign-in to your ChatApp account from ${deviceLabel}.`);
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
    const deviceLabel = describeUserAgent(req.get("user-agent"));
    const tokens = tokenService.issueTokens(user.id, deviceLabel);
    smsSecurityAlertStore.notify(user.id, user.phoneNumber, "login", `New sign-in to your ChatApp account from ${deviceLabel}.`);
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
    smsSecurityAlertStore.notify(
      userId,
      userStore.getById(userId)?.phoneNumber,
      "accountSecurity",
      "Two-factor authentication was turned off on your ChatApp account."
    );
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
    const deviceLabel = describeUserAgent(req.get("user-agent"));
    const tokens = tokenService.issueTokens(userId, deviceLabel);
    smsSecurityAlertStore.notify(
      userId,
      userStore.getById(userId)?.phoneNumber,
      "login",
      `New sign-in to your ChatApp account from ${deviceLabel}.`
    );
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
  app.post("/api/auth/signup/request-otp", async (req, res) => {
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
    if (!phoneNumber) {
      res.status(400).json({ error: "A valid phone number (E.164-ish, e.g. +15551234567) is required" });
      return;
    }

    // Bot detection: gates the one step that costs real money to abuse
    // (triggering an SMS send). Gracefully degrades when unconfigured —
    // see RecaptchaService.
    if (!(await recaptchaService.verify(req.body?.recaptchaToken))) {
      res.status(403).json({ error: "Bot verification failed" });
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
    const deviceLabel = describeUserAgent(req.get("user-agent"));
    const tokens = tokenService.issueTokens(user.id, deviceLabel);
    smsSecurityAlertStore.notify(user.id, user.phoneNumber, "login", `New sign-in to your ChatApp account from ${deviceLabel}.`);
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

  // Active sessions (#60): one entry per sign-in (see TokenService — a
  // token refresh keeps the same session, it doesn't create a new one).
  app.get("/api/auth/sessions", (req, res) => {
    const auth = requireAuthWithSession(req, res);
    if (!auth) return;
    const sessions = tokenService.listSessions(auth.userId).map((session) => ({
      ...session,
      isCurrent: session.id === auth.sessionId,
    }));
    res.json({ sessions });
  });

  // Registered ahead of the :sessionId route below so "others" is never
  // matched as a literal session id.
  app.delete("/api/auth/sessions/others", (req, res) => {
    const auth = requireAuthWithSession(req, res);
    if (!auth) return;
    const revokedCount = tokenService.revokeOtherSessions(auth.userId, auth.sessionId);
    if (revokedCount > 0) {
      smsSecurityAlertStore.notify(
        auth.userId,
        userStore.getById(auth.userId)?.phoneNumber,
        "accountSecurity",
        `You were logged out of ${revokedCount} other device${revokedCount === 1 ? "" : "s"}.`
      );
    }
    res.json({ revokedCount });
  });

  app.delete("/api/auth/sessions/:sessionId", (req, res) => {
    const auth = requireAuthWithSession(req, res);
    if (!auth) return;
    if (req.params.sessionId === auth.sessionId) {
      res.status(400).json({ error: "Use DELETE /api/auth/sessions/others to log out other devices, not this one" });
      return;
    }
    const revoked = tokenService.revokeSession(auth.userId, req.params.sessionId);
    if (!revoked) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.status(204).send();
  });

  // SMS security alerts (#158): Bumble/Tinder-style texts on login and
  // account-security-lowering events (2FA disabled, other devices logged
  // out — see the trigger points above), gated behind requireAuth same as
  // 2FA management since this is the caller's own notification settings.
  // Delivery itself is stubbed (see smsSecurityAlerts.ts) — no real SMS
  // provider credentials exist in this environment.
  app.get("/api/sms-security-alerts/preferences", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    res.json({ preferences: smsSecurityAlertStore.getPreferences(userId) });
  });

  app.put("/api/sms-security-alerts/preferences", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const result = smsSecurityAlertStore.setPreference(userId, req.body?.category, req.body?.enabled);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ preferences: smsSecurityAlertStore.getPreferences(userId) });
  });

  app.get("/api/sms-security-alerts/history", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    res.json({ alerts: smsSecurityAlertStore.getSentAlerts(userId) });
  });

  return {
    app,
    messagesByRoom,
    pushService,
    errorReportStore,
    otpService,
    recoveryCodeService,
    twoFactorService,
    smsSecurityAlertStore,
    webAuthnService,
    onboardingStore,
    verificationStore,
    reportStore,
    blockStore,
    contactBlockStore,
    pinnedChatsStore,
    archivedChatsStore,
    watermarkStore,
    photoStore,
    sharedDateStore,
    sosStore,
    webAuthnStore,
    duplicateAccountStore,
    discoveryVisibilityStore,
    photoAlbumStore,
    introVideoStore,
    voiceIntroStore,
    bioStore,
    profilePromptsStore,
    jobInfoStore,
    educationInfoStore,
    heightInfoStore,
    lifestyleInfoStore,
    familyPlansInfoStore,
    zodiacInfoStore,
    languagesInfoStore,
    beliefsInfoStore,
    petsInfoStore,
    personalityInfoStore,
    spotifyInfoStore,
    instagramInfoStore,
    interestsInfoStore,
    profileVisibilityStore,
    socialLinksInfoStore,
    travelModeInfoStore,
    profileColorThemeStore,
    achievementsInfoStore,
    displayNameModeStore,
    stylizedAvatarStore,
    swipeStore,
    smartScoreStore,
    discoveryFiltersStore,
    exploreModeStore,
    topPicksStore,
    profileVisitsStore,
    profileBoostStore,
    peakHoursStore,
    crossedPathsStore,
    squadStore,
    presenceStore,
    vanishModeStore,
    photoInteractionStore,
    contactsGraphStore,
    viewModeStore,
    weekendPlansStore,
    readReceiptStore,
    typingStore,
    liveLocationShareStore,
    callStore,
    videoCallEffectsStore,
    genderInfoStore,
    matchExpiryStore,
  };
}

export async function createChatServer() {
  const {
    app,
    messagesByRoom,
    pushService,
    reportStore,
    presenceStore,
    readReceiptStore,
    typingStore,
    liveLocationShareStore,
    callStore,
    blockStore,
    genderInfoStore,
    matchExpiryStore,
  } = createApp();
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

    // Badoo's real online/last-active indicator (#110): the client
    // announces its author once per connection so this socket can be
    // attributed to them on disconnect (see presence.ts for why a
    // connection *count* is tracked rather than a boolean — multi-tab).
    socket.on("presence:online", (author: string) => {
      if (typeof author !== "string" || !author) return;
      socket.data.author = author;
      presenceStore.markOnline(author);
      io.emit("presence:update", { author, ...presenceStore.getStatus(author) });
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

      // Strict policy against financial/crypto scams: its own dependency-
      // free check, same as the guest-mode check above.
      if (scanForScamContent(payload.text ?? "").flagged) {
        socket.emit("message:rejected", { reason: "scam_content" });
        return;
      }

      // Bumble's real AI "unkind message" warning (#143): unlike the scam
      // check above (a hard block) or spam below (silent auto-report),
      // this is a soft nudge — the sender gets a chance to edit or confirm
      // "send anyway" rather than the message being silently rejected or
      // silently let through. `overrideWarning` is only ever set by the
      // client's own confirm action, never by the initial send attempt.
      const contentWarning = scanForInappropriateContent(payload.text ?? "");
      if (contentWarning.flagged && !payload.overrideWarning) {
        socket.emit("message:warning", { reason: contentWarning.reason });
        return;
      }

      const roomId = payload.roomId || DEFAULT_ROOM_ID;

      // Both of these are only checked when the client tells us who this
      // message is for (a fresh 1:1 match's chat screen; this app's rooms
      // otherwise have no formal "these two people only" concept to
      // derive it from).
      if (payload.recipient) {
        // Bumble's real 24-hour match-expiry timer (#136): once expired
        // with no first message sent, the match is over — see
        // matchExpiry.ts.
        if (matchExpiryStore.isExpired(payload.author, payload.recipient)) {
          socket.emit("message:rejected", { reason: "match_expired" });
          return;
        }
        // Bumble's real "women message first" rule (#135) — only for the
        // very first message ever sent in the room. Uses genderInfo.ts's
        // own per-chat-author store — same "own per-field store keyed by
        // guest chat author" pattern as #67-89's other profile info, not
        // #21-28's auth-gated onboarding gender field, since guest chat
        // identities aren't merged with real accounts yet.
        if ((messagesByRoom.get(roomId) ?? []).length === 0) {
          const senderGender = genderInfoStore.get(payload.author);
          const recipientGender = genderInfoStore.get(payload.recipient);
          const check = canSendFirstMessage(senderGender, recipientGender);
          if (!check.allowed) {
            socket.emit("message:rejected", { reason: "first_message_gender_rule", error: check.error });
            return;
          }
        }
      }

      const message: ChatMessage = buildChatMessage(payload);

      // Feeld's real optional end-to-end encrypted chat (#149): the
      // server only checks the ciphertext/iv shape it's handed — it has
      // no key, so it can't validate or moderate the plaintext this
      // represents. That's the real, disclosed tradeoff of genuine E2EE
      // (same limitation Signal/WhatsApp have): an encrypted message's
      // `text` is empty, so #56's scam check and #58's spam auto-report
      // below have nothing to scan for it.
      if (payload.encrypted) {
        const { ciphertext, iv } = payload.encrypted;
        if (typeof ciphertext !== "string" || !ciphertext || typeof iv !== "string" || !iv) {
          socket.emit("message:rejected", { reason: "invalid_encrypted_payload" });
          return;
        }
        message.encrypted = { ciphertext, iv };
      }

      // Snapchat/Bumble's real "play a mini-game within chat" (#148) —
      // needs a known second player, so it's only offered against a
      // fresh 1:1 match's `recipient` (same "only meaningful with a
      // recipient" reasoning as #135's gender rule), never in a group
      // room. See ticTacToe.ts's createGame() for why this is a genuinely
      // playable game rather than a fabricated one.
      if (payload.startGame) {
        if (!payload.recipient) {
          socket.emit("message:rejected", { reason: "game_requires_recipient" });
          return;
        }
        message.game = createGame(message.author, payload.recipient);
      }

      // Bumble's real "suggest a type of date" quick-reply chip (#147) —
      // see dateProposals.ts for why this is a deliberately lighter-weight
      // sibling to #146's dateInvite rather than a duplicate of it. Falls
      // back to the category's own label as the message text so search
      // (#140) and notifications still have something meaningful to show,
      // same "server fills in the text a themed message didn't carry"
      // shape as #124's GIF messages leaving text empty by design — here
      // it isn't empty because there's no separate media to point at.
      if (payload.dateProposalCategory !== undefined) {
        if (!isDateProposalCategory(payload.dateProposalCategory)) {
          socket.emit("message:rejected", { reason: "invalid_date_proposal" });
          return;
        }
        message.dateProposalCategory = payload.dateProposalCategory;
        if (!message.text) {
          message.text = DATE_PROPOSAL_LABELS[payload.dateProposalCategory];
        }
      }

      // Bumble's real "Private Detector" AI photo warning (#144): flags a
      // plain image message (not #123's already tap-gated
      // selfDestructImageUrl) from a sender with enough reports to be a
      // real safety signal — this app's honest stand-in for a trained
      // NSFW-image classifier it has no vision model/API key for, same
      // "reuse an existing signal instead of fabricating one" precedent as
      // #107's fakeProfileDetector. The client blurs it behind a
      // tap-to-view warning rather than rendering it immediately.
      if (message.imageUrl && isSenderPhotoSuspicious(reportStore.countFor(message.author))) {
        message.suspicious = true;
      }

      if (payload.recipient) {
        matchExpiryStore.recordFirstMessage(payload.author, payload.recipient);
      }

      // WhatsApp/Bumble's real "share live location" (#127): a static
      // ("text") location share needs no extra validation beyond the
      // coordinates already carried on the message, but a live share
      // needs its duration validated and its authoritative expiresAt
      // computed server-side — see liveLocationShares.ts.
      if (payload.location?.live) {
        const startResult = liveLocationShareStore.start(
          message.id,
          message.author,
          payload.location.latitude,
          payload.location.longitude,
          payload.location.durationMinutes
        );
        if (!startResult.success) {
          socket.emit("message:rejected", { reason: "invalid_location" });
          return;
        }
        message.location = {
          latitude: payload.location.latitude,
          longitude: payload.location.longitude,
          label: payload.location.label,
          live: true,
          expiresAt: startResult.expiresAt,
        };
      }

      // Bumble's real "send a date invitation within chat" (#146) —
      // validated server-side (see dateInvites.ts) since the client-sent
      // fields are just a proposal; the authoritative "pending" status is
      // set here, the same "server owns the derived truth" stance as the
      // live-location expiresAt above.
      if (payload.dateInvite) {
        const inviteResult = createDateInvite(payload.dateInvite);
        if (!inviteResult.success) {
          socket.emit("message:rejected", { reason: "invalid_date_invite", error: inviteResult.error });
          return;
        }
        message.dateInvite = inviteResult.dateInvite;
      }

      // Report spam/promotional content to the monitoring system (#58):
      // unlike the scam check above, this doesn't block the send — Tinder's
      // real behavior is to route it to moderation, not break the
      // conversation over a promotional link.
      const spamScan = scanForSpamContent(message.text);
      if (spamScan.flagged) {
        reportStore.submit(SPAM_DETECTOR_REPORTER_AUTHOR, {
          reportedAuthor: message.author,
          messageId: message.id,
          reason: "spam",
          details: `Auto-flagged by spam detector (${spamScan.reason})`,
        });
      }

      // A sender who confirms "send anyway" past #143's warning still gets
      // auto-flagged to moderation (#41's ReportStore) rather than the
      // override silently making the flag disappear — Bumble's real policy
      // reviews repeated overrides even though the individual message
      // isn't blocked, same "warn, don't silently allow" precedent as
      // #58's spam auto-report above.
      if (contentWarning.flagged && payload.overrideWarning) {
        reportStore.submit(CONTENT_WARNING_REPORTER_AUTHOR, {
          reportedAuthor: message.author,
          messageId: message.id,
          reason: contentWarning.reason === "harassment" ? "harassment" : "inappropriateContent",
          details: `Sent after an inappropriate-content warning (${contentWarning.reason}) was overridden`,
        });
      }

      const existing = messagesByRoom.get(roomId) ?? [];
      existing.push(message);
      messagesByRoom.set(roomId, existing);
      // Sending a message counts as activity even for the rare case where
      // presence:online was never announced on this socket (see presence.ts).
      presenceStore.recordActivity(message.author);
      io.to(roomId).emit("message:new", message);
      pushService.notifyOthers(message.author, { title: message.author, body: message.text }).catch((err) => {
        console.error("Failed to deliver push notifications:", err);
      });
    });

    // Bumble's real sent/delivered/read message status (#125): the client
    // announces delivery the moment a message:new reaches it, and read
    // once the recipient has actually seen it (their tab is visible) —
    // see readReceipts.ts for why this is an aggregate "did any other
    // participant" status rather than a per-recipient list. Broadcasting
    // message:status to the whole room (rather than only the sender)
    // keeps a multi-tab sender in sync without extra bookkeeping.
    const reportReceipt = (
      event: "message:delivered" | "message:read",
      payload: { roomId?: string; messageId?: string; author?: string }
    ) => {
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
      const messageId = typeof payload?.messageId === "string" ? payload.messageId : "";
      const author = typeof payload?.author === "string" ? payload.author : "";
      if (!roomId || !messageId || !author) return;

      const message = messagesByRoom.get(roomId)?.find((m) => m.id === messageId);
      if (!message || message.author === author) return;

      if (event === "message:read") {
        readReceiptStore.markRead(messageId, author);
      } else {
        readReceiptStore.markDelivered(messageId, author);
      }
      io.to(roomId).emit("message:status", { messageId, status: readReceiptStore.getStatus(messageId, message.author) });
    };
    socket.on("message:delivered", (payload) => reportReceipt("message:delivered", payload));
    socket.on("message:read", (payload) => reportReceipt("message:read", payload));

    // Bumble's real "edit a sent message" (#133) — see messageEditing.ts
    // for the sender-only/time-window/text-only-message rules. Reuses the
    // same scam-content check message:send applies, so an edit can't be
    // used to slip content past moderation that a fresh send would catch.
    socket.on("message:edit", (payload: { roomId?: string; messageId?: string; author?: string; text?: unknown }) => {
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
      const messageId = typeof payload?.messageId === "string" ? payload.messageId : "";
      const author = typeof payload?.author === "string" ? payload.author : "";
      const text = typeof payload?.text === "string" ? payload.text.trim() : "";
      if (!roomId || !messageId || !author || !text) return;

      const message = messagesByRoom.get(roomId)?.find((m) => m.id === messageId);
      if (!message) {
        socket.emit("message:edit-rejected", { messageId, error: "Message not found" });
        return;
      }
      const check = canEditMessage(message, author);
      if (!check.allowed) {
        socket.emit("message:edit-rejected", { messageId, error: check.error });
        return;
      }
      if (scanForScamContent(text).flagged) {
        socket.emit("message:edit-rejected", { messageId, error: "That edit looks like it violates ChatApp's policy against financial and crypto scams" });
        return;
      }

      message.text = text;
      message.edited = true;
      io.to(roomId).emit("message:edited", { messageId, text: message.text, edited: true });
    });

    // Snapchat/Bumble's real "play a mini-game within chat" (#148) — one
    // move at a time, mutated in place (see ticTacToe.ts's applyMove for
    // the turn/cell/game-over validation) the same way message:edit
    // mutates its message directly above.
    socket.on(
      "game:move",
      (payload: { roomId?: string; messageId?: string; author?: string; cellIndex?: unknown }) => {
        const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
        const messageId = typeof payload?.messageId === "string" ? payload.messageId : "";
        const author = typeof payload?.author === "string" ? payload.author : "";
        if (!roomId || !messageId || !author) return;

        const message = messagesByRoom.get(roomId)?.find((m) => m.id === messageId);
        if (!message?.game) {
          socket.emit("game:rejected", { messageId, error: "Game not found" });
          return;
        }

        const result = applyMove(message.game, author, payload?.cellIndex);
        if (!result.success) {
          socket.emit("game:rejected", { messageId, error: result.error });
          return;
        }

        message.game = result.game;
        io.to(roomId).emit("game:updated", { messageId, game: message.game });
      }
    );

    // Bumble's real "send a date invitation within chat" (#146) — the
    // recipient's accept/decline, mutating the invite in place (see
    // dateInvites.ts's respondToDateInvite for the sender-can't-respond/
    // already-decided rules) the same way message:edit mutates its
    // message directly above.
    socket.on(
      "date-invite:respond",
      (payload: { roomId?: string; messageId?: string; author?: string; response?: unknown }) => {
        const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
        const messageId = typeof payload?.messageId === "string" ? payload.messageId : "";
        const author = typeof payload?.author === "string" ? payload.author : "";
        if (!roomId || !messageId || !author) return;

        const message = messagesByRoom.get(roomId)?.find((m) => m.id === messageId);
        if (!message?.dateInvite) {
          socket.emit("date-invite:rejected", { messageId, error: "Date invitation not found" });
          return;
        }

        const result = respondToDateInvite(message.dateInvite, message.author, author, payload?.response);
        if (!result.success) {
          socket.emit("date-invite:rejected", { messageId, error: result.error });
          return;
        }

        message.dateInvite = result.dateInvite;
        io.to(roomId).emit("date-invite:updated", { messageId, dateInvite: message.dateInvite });
      }
    );

    // WhatsApp/Bumble's real "Delete for Everyone" (#134) — see
    // messageDeletion.ts for the sender-only/time-window rule. Unlike
    // #133's edit, any message type can be deleted: content fields are
    // cleared and replaced with a placeholder rather than needing new
    // content to render. Scoped to the message record itself — this
    // doesn't chase down and purge an associated stored blob in
    // voiceNotes.ts/selfDestructPhotos.ts, an acceptable gap since those
    // are already keyed by an unguessable random id no one else has.
    socket.on("message:delete", (payload: { roomId?: string; messageId?: string; author?: string }) => {
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
      const messageId = typeof payload?.messageId === "string" ? payload.messageId : "";
      const author = typeof payload?.author === "string" ? payload.author : "";
      if (!roomId || !messageId || !author) return;

      const message = messagesByRoom.get(roomId)?.find((m) => m.id === messageId);
      if (!message) {
        socket.emit("message:delete-rejected", { messageId, error: "Message not found" });
        return;
      }
      const check = canDeleteMessage(message, author);
      if (!check.allowed) {
        socket.emit("message:delete-rejected", { messageId, error: check.error });
        return;
      }

      message.text = "";
      message.imageUrl = undefined;
      message.audioUrl = undefined;
      message.waveform = undefined;
      message.selfDestructImageUrl = undefined;
      message.location = undefined;
      message.deleted = true;
      io.to(roomId).emit("message:deleted", { messageId });
    });

    // WhatsApp/Bumble's real "share live location" (#127) — periodic
    // position updates for an already-started live share (see
    // liveLocationShares.ts and message:send above for how it starts).
    // Rejected privately to the sharer rather than broadcast, since only
    // they need to know their own share ended/was invalid.
    socket.on(
      "location:update",
      (payload: { roomId?: string; messageId?: string; author?: string; latitude?: unknown; longitude?: unknown }) => {
        const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
        const messageId = typeof payload?.messageId === "string" ? payload.messageId : "";
        const author = typeof payload?.author === "string" ? payload.author : "";
        if (!roomId || !messageId || !author) return;

        const result = liveLocationShareStore.update(messageId, author, payload.latitude, payload.longitude);
        if (!result.success) {
          socket.emit("location:rejected", { messageId, error: result.error });
          return;
        }
        io.to(roomId).emit("location:update", { messageId, latitude: result.latitude, longitude: result.longitude });
      }
    );

    // Badoo's real in-app audio/video call (#128, extended to video by
    // #129) — signaling only, broadcast to the room the same way chat
    // messages are (recipients are already joined to it), with clients
    // filtering for events addressed to them. See calls.ts for the actual
    // state machine and why there's no per-user socket routing here.
    socket.on("call:invite", (payload: { roomId?: string; caller?: string; callee?: string; video?: unknown }) => {
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
      const caller = typeof payload?.caller === "string" ? payload.caller : "";
      const callee = typeof payload?.callee === "string" ? payload.callee : "";
      if (!roomId || !caller || !callee) return;

      const isBlocked = blockStore.getBlockedAuthors(caller).includes(callee) || blockStore.getBlockedAuthors(callee).includes(caller);
      if (isBlocked) {
        socket.emit("call:rejected", { reason: "blocked" });
        return;
      }
      // Bumble's real "mandatory text-first" gate (#130) — audio calls
      // (#128) aren't gated, only video.
      if (payload?.video) {
        const eligibility = checkVideoCallEligibility(messagesByRoom.get(roomId) ?? [], caller, callee);
        if (!eligibility.eligible) {
          socket.emit("call:rejected", {
            reason: `Send ${eligibility.required - eligibility.messagesExchanged} more message(s) before starting a video call`,
          });
          return;
        }
      }
      const result = callStore.initiate(roomId, caller, callee, payload?.video);
      if (!result.success) {
        socket.emit("call:rejected", { reason: result.error });
        return;
      }
      io.to(roomId).emit("call:incoming", result.call);
    });

    socket.on("call:accept", (payload: { callId?: string; author?: string }) => {
      const callId = typeof payload?.callId === "string" ? payload.callId : "";
      const author = typeof payload?.author === "string" ? payload.author : "";
      if (!callId || !author) return;
      const result = callStore.accept(callId, author);
      if (!result.success) return;
      io.to(result.call.roomId).emit("call:accepted", result.call);
    });

    // Covers both the callee declining before pickup and either side
    // hanging up once active — calls.ts's end() allows both participants.
    socket.on("call:end", (payload: { callId?: string; author?: string }) => {
      const callId = typeof payload?.callId === "string" ? payload.callId : "";
      const author = typeof payload?.author === "string" ? payload.author : "";
      if (!callId || !author) return;
      const call = callStore.get(callId);
      const result = callStore.end(callId, author);
      if (!result.success || !call) return;
      io.to(call.roomId).emit("call:ended", { callId, endedBy: author });
    });

    // WebRTC offer/answer/ICE-candidate relay — this server never touches
    // the actual audio stream, only these signaling payloads, exactly the
    // production-standard division of responsibility. `data` is opaque to
    // the server; only the intended recipient's client interprets it.
    socket.on("call:signal", (payload: { callId?: string; roomId?: string; from?: string; to?: string; data?: unknown }) => {
      const callId = typeof payload?.callId === "string" ? payload.callId : "";
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
      const from = typeof payload?.from === "string" ? payload.from : "";
      const to = typeof payload?.to === "string" ? payload.to : "";
      if (!callId || !roomId || !from || !to) return;
      if (!callStore.get(callId)) return;
      io.to(roomId).emit("call:signal", { callId, from, to, data: payload.data });
    });

    // Bumble's real typing indicator (#126) — client-driven start/stop
    // (the client debounces its own "stopped typing" after a pause in
    // keystrokes; see typing.ts for why there's no reliable server-side
    // signal otherwise). Broadcast to the room excluding the typer, who
    // has no need to see their own indicator reflected back.
    const broadcastTyping = (roomId: string) => {
      socket.to(roomId).emit("typing:update", { roomId, authors: typingStore.getTypingAuthors(roomId) });
    };
    socket.on("typing:start", (payload: { roomId?: string; author?: string }) => {
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
      const author = typeof payload?.author === "string" ? payload.author : "";
      if (!roomId || !author) return;
      // Same disconnect-cleanup attribution presence:online sets up — a
      // client could start typing before ever announcing presence.
      socket.data.author = author;
      typingStore.startTyping(roomId, author);
      broadcastTyping(roomId);
    });
    socket.on("typing:stop", (payload: { roomId?: string; author?: string }) => {
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
      const author = typeof payload?.author === "string" ? payload.author : "";
      if (!roomId || !author) return;
      typingStore.stopTyping(roomId, author);
      broadcastTyping(roomId);
    });

    // "disconnecting" (not "disconnect") fires while socket.rooms is still
    // populated — Socket.io removes the socket from every room right
    // after this event, before "disconnect" fires — so this is the only
    // place a room-scoped disconnect broadcast can still reach anyone.
    socket.on("disconnecting", () => {
      const author = socket.data.author as string | undefined;
      if (!author) return;
      // Safety net for an unclean disconnect (dropped connection, closed
      // tab) so a typing indicator never gets stuck on for other
      // participants — see typing.ts.
      typingStore.stopTypingEverywhere(author);
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        io.to(roomId).emit("typing:update", { roomId, authors: typingStore.getTypingAuthors(roomId) });
      }
    });

    socket.on("disconnect", () => {
      messageRateLimiter.clear(socket.id);
      const author = socket.data.author as string | undefined;
      if (author) {
        presenceStore.markOffline(author);
        io.emit("presence:update", { author, ...presenceStore.getStatus(author) });
      }
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
