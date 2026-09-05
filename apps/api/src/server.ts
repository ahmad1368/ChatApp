import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { TwoFactorService } from "./twoFactor";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(twoFactorService: TwoFactorService) {
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

  // SECURITY NOTE: these endpoints trust a client-supplied `userId` rather
  // than deriving it from a verified access token, because this branch has
  // no merged TokenService to authenticate against (5 separate auth PRs —
  // #21-#25 — are still unmerged, each with its own). That makes this
  // interface unsafe to expose as-is: anyone could set up, verify, or
  // disable 2FA for any userId. Before shipping, gate all three endpoints
  // behind whichever TokenService lands and take userId from the verified
  // token instead of the request body.

  app.post("/api/auth/2fa/setup", async (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const accountLabel = typeof req.body?.accountLabel === "string" ? req.body.accountLabel : userId;
    if (!userId || !accountLabel) {
      res.status(400).json({ error: "userId and accountLabel are required" });
      return;
    }
    const result = await twoFactorService.beginSetup(userId, accountLabel);
    res.status(200).json(result);
  });

  app.post("/api/auth/2fa/confirm-setup", (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const token = typeof req.body?.token === "string" ? req.body.token : undefined;
    if (!userId || !token) {
      res.status(400).json({ error: "userId and token are required" });
      return;
    }
    const confirmed = twoFactorService.confirmSetup(userId, token);
    if (!confirmed) {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }
    res.json({ enabled: true });
  });

  app.post("/api/auth/2fa/verify", (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const token = typeof req.body?.token === "string" ? req.body.token : undefined;
    if (!userId || !token) {
      res.status(400).json({ error: "userId and token are required" });
      return;
    }
    const valid = twoFactorService.verify(userId, token);
    if (!valid) {
      res.status(401).json({ error: "Invalid or expired code" });
      return;
    }
    res.json({ verified: true });
  });

  app.get("/api/auth/2fa/status/:userId", (req, res) => {
    res.json({ enabled: twoFactorService.isEnabled(req.params.userId) });
  });

  app.post("/api/auth/2fa/disable", (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    twoFactorService.disable(userId);
    res.json({ enabled: false });
  });

  return { app, messagesByRoom };
}

export function createChatServer(twoFactorService: TwoFactorService) {
  const { app, messagesByRoom } = createApp(twoFactorService);
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
  const httpServer = createChatServer(new TwoFactorService());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
