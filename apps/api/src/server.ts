import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { ErrorReportStore } from "./errorReports";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(errorReportStore: ErrorReportStore) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const messagesByRoom = new Map<string, ChatMessage[]>();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/rooms/:roomId/messages", (req, res) => {
    const { roomId } = req.params;
    res.json(messagesByRoom.get(roomId) ?? []);
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

  return { app, messagesByRoom };
}

export function createChatServer(errorReportStore: ErrorReportStore) {
  const { app, messagesByRoom } = createApp(errorReportStore);
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
  const errorReportStore = new ErrorReportStore();
  const httpServer = createChatServer(errorReportStore);
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
