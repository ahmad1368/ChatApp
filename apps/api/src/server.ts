import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { SOSStore } from "./sos";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(sosStore: SOSStore): { app: Express; messagesByRoom: Map<string, ChatMessage[]> } {
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

  // Emergency SOS: its own high-priority, dependency-free safety path,
  // same as Report/Block/Share My Date.
  app.post("/api/sos/contacts", (req, res) => {
    const result = sosStore.addContact(req.body?.author, req.body?.name, req.body?.contactMethod);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.contact);
  });

  app.get("/api/sos/contacts/:author", (req, res) => {
    res.json({ contacts: sosStore.listContacts(req.params.author) });
  });

  app.post("/api/sos/alerts", (req, res) => {
    const result = sosStore.triggerSOS(req.body?.author, req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.alert);
  });

  app.patch("/api/sos/alerts/:id/location", (req, res) => {
    const result = sosStore.updateLocation(req.body?.author, req.params.id, req.body);
    if (!result.success) {
      const status = result.error === "Alert not found" ? 404 : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    res.json(result.alert);
  });

  app.post("/api/sos/alerts/:id/resolve", (req, res) => {
    const resolved = sosStore.resolve(req.body?.author, req.params.id);
    if (!resolved) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.status(204).send();
  });

  app.get("/api/sos/alerts/shared/:shareCode", (req, res) => {
    const view = sosStore.viewByShareCode(req.params.shareCode);
    if (!view) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.json(view);
  });

  return { app, messagesByRoom };
}

export function createChatServer(sosStore: SOSStore) {
  const { app, messagesByRoom } = createApp(sosStore);
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
  const httpServer = createChatServer(new SOSStore());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
