import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { exportDataForAuthor } from "./dataExport";
import { isValidCoordinates, LocationStore } from "./locationPrivacy";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(): { app: Express; messagesByRoom: Map<string, ChatMessage[]> } {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const messagesByRoom = new Map<string, ChatMessage[]>();
  const locations = new LocationStore();

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

  // Location privacy: a user's exact coordinates never leave this process —
  // every read returns a coordinate snapped to a ~5km grid cell instead.
  app.put("/api/users/:author/location", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    if (!isValidCoordinates(req.body)) {
      res.status(400).json({ error: "lat/lng must be numbers within valid ranges" });
      return;
    }
    locations.setLocation(author, req.body);
    res.json({ approximate: locations.getApproximateLocation(author) });
  });

  app.get("/api/users/:author/location", (req, res) => {
    const author = req.params.author?.trim();
    if (!author) {
      res.status(400).json({ error: "author is required" });
      return;
    }
    const approximate = locations.getApproximateLocation(author);
    if (!approximate) {
      res.status(404).json({ error: "no location on file for this user" });
      return;
    }
    res.json({ approximate });
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
