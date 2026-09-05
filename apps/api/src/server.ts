import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { PhotoStore } from "./photos";
import { applyWatermark } from "./watermarkImage";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(photoStore: PhotoStore): { app: Express; messagesByRoom: Map<string, ChatMessage[]> } {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  const messagesByRoom = new Map<string, ChatMessage[]>();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/rooms/:roomId/messages", (req, res) => {
    const { roomId } = req.params;
    res.json(messagesByRoom.get(roomId) ?? []);
  });

  // Photo theft deterrence: this is its own high-priority, dependency-free
  // safety path, independent of any matching/discovery service.
  app.post("/api/photos", (req, res) => {
    const result = photoStore.upload(req.body?.author, req.body?.mimeType, req.body?.data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ id: result.photo.id });
  });

  // Watermarks are burned into the pixel data dynamically on every serve
  // (never stored pre-watermarked), so they survive any copy of the bytes —
  // a download, a re-upload, a screenshot of the raw file — not just a DOM
  // overlay a determined thief could strip before saving.
  app.get("/api/photos/:id", async (req, res) => {
    const photo = photoStore.get(req.params.id);
    if (!photo) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }
    const viewer = typeof req.query.viewer === "string" && req.query.viewer.trim() ? req.query.viewer.trim() : "ChatApp";
    try {
      const watermarked = await applyWatermark(photo.data, viewer);
      res.setHeader("Content-Type", "image/png");
      res.status(200).send(watermarked);
    } catch {
      res.status(500).json({ error: "Failed to render photo" });
    }
  });

  return { app, messagesByRoom };
}

export function createChatServer(photoStore: PhotoStore) {
  const { app, messagesByRoom } = createApp(photoStore);
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
  const httpServer = createChatServer(new PhotoStore());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
