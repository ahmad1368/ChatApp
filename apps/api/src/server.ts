import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { RateLimiter } from "./rateLimiter";
import { createRedisAdapterIfConfigured } from "./redisAdapter";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MESSAGE_RATE_LIMIT = 20;
const MESSAGE_RATE_WINDOW_MS = 10_000;

export function createApp() {
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

  return { app, messagesByRoom };
}

export async function createChatServer() {
  const { app, messagesByRoom } = createApp();
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
