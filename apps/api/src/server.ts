import cors from "cors";
import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { WebAuthnStore } from "./webauthn";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(webAuthnStore: WebAuthnStore): { app: Express; messagesByRoom: Map<string, ChatMessage[]> } {
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

  // Biometric re-authentication: its own high-priority, dependency-free safety
  // path, same as Report/Block/SOS.
  app.get("/api/webauthn/status/:author", (req, res) => {
    res.json({ registered: webAuthnStore.isRegistered(req.params.author) });
  });

  app.post("/api/webauthn/registration/options", async (req, res) => {
    const result = await webAuthnStore.createRegistrationOptions(req.body?.author);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.options);
  });

  app.post("/api/webauthn/registration/verify", async (req, res) => {
    const result = await webAuthnStore.verifyRegistration(req.body?.author, req.body?.response);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(204).send();
  });

  app.post("/api/webauthn/authentication/options", async (req, res) => {
    const result = await webAuthnStore.createAuthenticationOptions(req.body?.author);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.options);
  });

  app.post("/api/webauthn/authentication/verify", async (req, res) => {
    const result = await webAuthnStore.verifyAuthentication(req.body?.author, req.body?.response);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(204).send();
  });

  return { app, messagesByRoom };
}

export function createChatServer(webAuthnStore: WebAuthnStore) {
  const { app, messagesByRoom } = createApp(webAuthnStore);
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
  const httpServer = createChatServer(new WebAuthnStore());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
