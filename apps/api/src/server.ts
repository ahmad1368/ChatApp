import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { exportDataForAuthor } from "./dataExport";
import { AccountDeletionCoordinator, deleteMessagesForAuthor } from "./accountDeletion";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(): { app: Express; messagesByRoom: Map<string, ChatMessage[]> } {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const messagesByRoom = new Map<string, ChatMessage[]>();

  const accountDeletion = new AccountDeletionCoordinator();
  accountDeletion.register((author) => deleteMessagesForAuthor(messagesByRoom, author));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/rooms/:roomId/messages", (req, res) => {
    const { roomId } = req.params;
    res.json(messagesByRoom.get(roomId) ?? []);
  });

  // GDPR data portability: its own high-priority, dependency-free path,
  // same as Report/Block/SOS. Streams the requester's own data back as a
  // downloadable JSON backup rather than requiring a separate export job.
  app.get("/api/account/:author/export", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    const dataExport = exportDataForAuthor(messagesByRoom, author);
    res.setHeader("Content-Disposition", `attachment; filename="chatapp-data-${encodeURIComponent(author)}.json"`);
    res.json(dataExport);
  });

  // GDPR erasure: its own high-priority, dependency-free safety path, same
  // as Report/Block/SOS. See AccountDeletionCoordinator for why this is a
  // registry rather than a single hardcoded purge.
  app.delete("/api/account/:author", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    res.json(accountDeletion.deleteAllDataFor(author));
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
