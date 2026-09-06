import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { RateLimiter } from "./rateLimiter";
import { createRedisAdapterIfConfigured } from "./redisAdapter";
import { ErrorReportStore } from "./errorReports";
import { buildChatMessage } from "./messages";
import { exportDataForAuthor } from "./dataExport";
import { AccountDeletionCoordinator, deleteMessagesForAuthor } from "./accountDeletion";
import { isValidCoordinates, LocationStore } from "./locationPrivacy";
import { PushService } from "./push";
import { UploadStore } from "./uploads";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MESSAGE_RATE_LIMIT = 20;
const MESSAGE_RATE_WINDOW_MS = 10_000;

export function createApp(): {
  app: Express;
  messagesByRoom: Map<string, ChatMessage[]>;
  pushService: PushService;
  errorReportStore: ErrorReportStore;
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

  const accountDeletion = new AccountDeletionCoordinator();
  accountDeletion.register((author) => deleteMessagesForAuthor(messagesByRoom, author));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
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
    const all = messagesByRoom.get(roomId) ?? [];

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

  return { app, messagesByRoom, pushService, errorReportStore };
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
