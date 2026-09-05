import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { BlockStore } from "./blocks";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(blockStore: BlockStore): { app: Express; messagesByRoom: Map<string, ChatMessage[]> } {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const messagesByRoom = new Map<string, ChatMessage[]>();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/rooms/:roomId/messages", (req, res) => {
    const { roomId } = req.params;
    const viewer = typeof req.query.viewer === "string" ? req.query.viewer : "";
    const messages = messagesByRoom.get(roomId) ?? [];
    const visible = viewer
      ? messages.filter((m) => !blockStore.isMutuallyBlocked(viewer, m.author))
      : messages;
    res.json(visible);
  });

  // Blocking is a safety-critical, high-priority path kept independent of any
  // heavier service (matching, discovery, etc.) so it always works.
  app.post("/api/blocks", (req, res) => {
    const result = blockStore.block(req.body?.blockerAuthor, req.body?.blockedAuthor);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.record);
  });

  app.delete("/api/blocks", (req, res) => {
    const removed = blockStore.unblock(req.body?.blockerAuthor, req.body?.blockedAuthor);
    if (!removed) {
      res.status(404).json({ error: "Block not found" });
      return;
    }
    res.status(204).send();
  });

  // Self-lookup only: returns the authors *this* blocker has blocked, never
  // who has blocked a given author (that would leak block state to the blocked party).
  app.get("/api/blocks/:blockerAuthor", (req, res) => {
    res.json({ blockedAuthors: blockStore.getBlockedAuthors(req.params.blockerAuthor) });
  });

  return { app, messagesByRoom };
}

export function createChatServer(blockStore: BlockStore) {
  const { app, messagesByRoom } = createApp(blockStore);
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const authorBySocketId = new Map<string, string>();

  io.on("connection", (socket) => {
    socket.on("identify", (author: string) => {
      if (typeof author === "string" && author.trim()) {
        authorBySocketId.set(socket.id, author.trim());
      }
    });

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

      // Deliver per-socket (not a single room broadcast) so a blocked pair
      // never receives each other's messages — this is what makes blocking
      // actually prevent "re-encountering" someone, not just hide them in the UI.
      const room = io.sockets.adapter.rooms.get(roomId);
      if (!room) return;
      for (const socketId of room) {
        const viewerAuthor = authorBySocketId.get(socketId);
        if (viewerAuthor && blockStore.isMutuallyBlocked(viewerAuthor, message.author)) {
          continue;
        }
        io.sockets.sockets.get(socketId)?.emit("message:new", message);
      }
    });

    socket.on("disconnect", () => {
      authorBySocketId.delete(socket.id);
    });
  });

  return httpServer;
}

if (require.main === module) {
  const httpServer = createChatServer(new BlockStore());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
