import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { TokenService } from "./auth";
import { WebAuthnService } from "./webauthn";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(webAuthnService: WebAuthnService, tokenService: TokenService) {
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

  // SECURITY NOTE: registration is gated by a client-supplied userId rather
  // than a verified access token, for the same reason as #26's 2FA
  // endpoints — no auth PR (#21-#25) is merged yet to authenticate against.
  // Registering a biometric credential for an arbitrary userId must be
  // gated behind a real session before this ships; login verification
  // itself is safe as written (it only ever proves possession of a
  // specific credential already registered to that userId).

  app.post("/api/auth/webauthn/register/options", async (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const username = typeof req.body?.username === "string" ? req.body.username : userId;
    if (!userId || !username) {
      res.status(400).json({ error: "userId and username are required" });
      return;
    }
    const options = await webAuthnService.generateRegistrationOptions(userId, username);
    res.json(options);
  });

  app.post("/api/auth/webauthn/register/verify", async (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const response = req.body?.response;
    if (!userId || !response) {
      res.status(400).json({ error: "userId and response are required" });
      return;
    }
    const verified = await webAuthnService.verifyRegistration(userId, response);
    if (!verified) {
      res.status(400).json({ error: "Could not verify the new credential" });
      return;
    }
    res.json({ verified: true });
  });

  app.post("/api/auth/webauthn/login/options", async (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const options = await webAuthnService.generateAuthenticationOptions(userId);
    if (!options) {
      res.status(404).json({ error: "No biometric credential registered for this user" });
      return;
    }
    res.json(options);
  });

  app.post("/api/auth/webauthn/login/verify", async (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const response = req.body?.response;
    if (!userId || !response) {
      res.status(400).json({ error: "userId and response are required" });
      return;
    }
    const verified = await webAuthnService.verifyAuthentication(userId, response);
    if (!verified) {
      res.status(401).json({ error: "Biometric verification failed" });
      return;
    }
    const tokens = tokenService.issueTokens(userId);
    res.json({ tokens });
  });

  app.get("/api/auth/webauthn/status/:userId", (req, res) => {
    res.json({ hasCredentials: webAuthnService.hasCredentials(req.params.userId) });
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

export function createChatServer(webAuthnService: WebAuthnService, tokenService: TokenService) {
  const { app, messagesByRoom } = createApp(webAuthnService, tokenService);
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
  const webAuthnService = new WebAuthnService({
    rpId: process.env.WEBAUTHN_RP_ID ?? "localhost",
    origin: process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000",
  });
  const httpServer = createChatServer(webAuthnService, new TokenService());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
