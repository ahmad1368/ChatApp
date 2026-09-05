import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { PushService } from "./push";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(pushService: PushService) {
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

  return { app, messagesByRoom };
}

export function createChatServer(pushService: PushService) {
  const { app, messagesByRoom } = createApp(pushService);
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
      pushService.notifyOthers(message.author, { title: message.author, body: message.text }).catch((err) => {
        console.error("Failed to deliver push notifications:", err);
      });
    });
  });

  return httpServer;
}

if (require.main === module) {
  const pushService = new PushService();
  const httpServer = createChatServer(pushService);
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
