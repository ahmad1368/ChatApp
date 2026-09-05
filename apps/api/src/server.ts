import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { MessageStore } from "./rooms";

export function createApp(store: MessageStore) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // `since` (ISO timestamp) lets a reconnecting client fetch only the
  // messages it missed instead of the full room history.
  app.get("/api/rooms/:roomId/messages", (req, res) => {
    const { roomId } = req.params;
    const since = typeof req.query.since === "string" ? req.query.since : undefined;
    res.json(store.list(roomId, since));
  });

  return app;
}

export function createChatServer(store: MessageStore) {
  const app = createApp(store);
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
      store.add(roomId, message);
      io.to(roomId).emit("message:new", message);
    });
  });

  return httpServer;
}

if (require.main === module) {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
  const store = new MessageStore();
  const httpServer = createChatServer(store);
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
