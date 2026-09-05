import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function createApp() {
  const app = express();
  // Custom response headers aren't visible to browser fetch() by default —
  // must be explicitly exposed via CORS for the client to read X-Has-More.
  app.use(cors({ exposedHeaders: ["X-Has-More"] }));
  app.use(express.json());

  const messagesByRoom = new Map<string, ChatMessage[]>();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Backward compatible: with no `limit`, behaves exactly as before (full
  // history, plain array). `limit` opts into cursor pagination — the page of
  // `limit` messages immediately before `before` (or the most recent page if
  // omitted) — so a client only pays for what it actually renders, which
  // matters most on mobile-grade connections. `X-Has-More` is a header, not
  // a body-shape change, so existing callers expecting a bare array keep
  // working unmodified.
  app.get("/api/rooms/:roomId/messages", (req, res) => {
    const { roomId } = req.params;
    const all = messagesByRoom.get(roomId) ?? [];

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

  return { app, messagesByRoom };
}

export function createChatServer() {
  const { app, messagesByRoom } = createApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    socket.on("join", (roomId: string = DEFAULT_ROOM_ID) => {
      socket.join(roomId);
    });

    socket.on("message:send", (payload: SendMessagePayload) => {
      const roomId = payload.roomId || DEFAULT_ROOM_ID;
      const message: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        roomId,
        author: payload.author,
        text: payload.text,
        createdAt: new Date().toISOString(),
      };
      const existing = messagesByRoom.get(roomId) ?? [];
      existing.push(message);
      messagesByRoom.set(roomId, existing);
      io.to(roomId).emit("message:new", message);
    });
  });

  return httpServer;
}

if (require.main === module) {
  const httpServer = createChatServer();
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
