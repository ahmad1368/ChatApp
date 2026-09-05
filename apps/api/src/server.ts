import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { WatermarkStore } from "./watermark";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(watermarkStore: WatermarkStore): { app: Express; messagesByRoom: Map<string, ChatMessage[]> } {
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

  // DRM/screenshot policy: browsers have no API to block or detect an OS-level
  // screenshot, so this is a high-priority, dependency-free deterrence path —
  // issue a per-viewing-session trace code the client stamps into an on-screen
  // watermark, so a leaked screenshot can be traced back to who viewed it.
  app.post("/api/watermark/session", (req, res) => {
    const session = watermarkStore.issueTraceCode(req.body?.author, req.body?.roomId);
    if (!session) {
      res.status(400).json({ error: "author and roomId are required" });
      return;
    }
    res.status(201).json(session);
  });

  return { app, messagesByRoom };
}

export function createChatServer(watermarkStore: WatermarkStore) {
  const { app, messagesByRoom } = createApp(watermarkStore);
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
  const httpServer = createChatServer(new WatermarkStore());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
