import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { ReportStore } from "./reports";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(reportStore: ReportStore) {
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

  // Safety-critical action: kept as its own tiny route with no dependency
  // on the chat/upload/onboarding subsystems, per the issue's
  // implementation guide ("no dependency on heavier services"). No GET
  // endpoint exposes stored reports — they contain claims about other
  // users and aren't safe to serve without real moderator auth.
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

  return { app, messagesByRoom };
}

export function createChatServer(reportStore: ReportStore) {
  const { app, messagesByRoom } = createApp(reportStore);
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
  const httpServer = createChatServer(new ReportStore());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
