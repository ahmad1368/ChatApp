import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { TokenService, UserStore } from "./auth";
import { GoogleAuthService } from "./googleAuth";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(googleAuthService: GoogleAuthService, userStore: UserStore, tokenService: TokenService) {
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

  app.post("/api/auth/google", async (req, res) => {
    if (!googleAuthService.isConfigured()) {
      res.status(503).json({ error: "Google Sign-In is not configured on this server" });
      return;
    }

    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : undefined;
    if (!idToken) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }

    const profile = await googleAuthService.verify(idToken);
    if (!profile) {
      res.status(401).json({ error: "Invalid Google ID token" });
      return;
    }

    const user = userStore.findOrCreateByGoogle(profile);
    const tokens = tokenService.issueTokens(user.id);
    res.json({ user, tokens });
  });

  app.post("/api/auth/refresh", (req, res) => {
    const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
    if (!refreshToken) {
      res.status(400).json({ error: "refreshToken is required" });
      return;
    }
    const tokens = tokenService.refresh(refreshToken);
    if (!tokens) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }
    res.json({ tokens });
  });

  return { app, messagesByRoom };
}

export function createChatServer(googleAuthService: GoogleAuthService, userStore: UserStore, tokenService: TokenService) {
  const { app, messagesByRoom } = createApp(googleAuthService, userStore, tokenService);
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
  const httpServer = createChatServer(new GoogleAuthService(), new UserStore(), new TokenService());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
