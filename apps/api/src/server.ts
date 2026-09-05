import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { SafetyPlanStore } from "./safetyPlans";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(safetyPlanStore: SafetyPlanStore): { app: Express; messagesByRoom: Map<string, ChatMessage[]> } {
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

  // "Share your date": its own high-priority, dependency-free safety path,
  // same as Report/Block. A share code alone grants read access, matching
  // the Bumble/Tinder "share my date" pattern (no trusted-contact auth exists).
  app.post("/api/safety/plans", (req, res) => {
    const result = safetyPlanStore.create(req.body?.author, req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.plan);
  });

  app.get("/api/safety/plans/shared/:shareCode", (req, res) => {
    const view = safetyPlanStore.getByShareCode(req.params.shareCode);
    if (!view) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.json(view);
  });

  return { app, messagesByRoom };
}

export function createChatServer(safetyPlanStore: SafetyPlanStore) {
  const { app, messagesByRoom } = createApp(safetyPlanStore);
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
  const httpServer = createChatServer(new SafetyPlanStore());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
