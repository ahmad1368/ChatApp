import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { SharedDateStore } from "./sharedDates";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(sharedDateStore: SharedDateStore): { app: Express; messagesByRoom: Map<string, ChatMessage[]> } {
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

  // "Share My Date": its own high-priority, dependency-free safety path,
  // same as Report/Block. Each trusted contact gets a distinct share code.
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

  return { app, messagesByRoom };
}

export function createChatServer(sharedDateStore: SharedDateStore) {
  const { app, messagesByRoom } = createApp(sharedDateStore);
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
  const httpServer = createChatServer(new SharedDateStore());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
