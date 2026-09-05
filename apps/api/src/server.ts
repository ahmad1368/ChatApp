import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";
import { normalizePhoneNumber, OtpService, TokenService, UserStore } from "./auth";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

export function createApp(otpService: OtpService, userStore: UserStore, tokenService: TokenService) {
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

  app.post("/api/auth/signup/request-otp", (req, res) => {
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
    if (!phoneNumber) {
      res.status(400).json({ error: "A valid phone number (E.164-ish, e.g. +15551234567) is required" });
      return;
    }

    const result = otpService.requestOtp(phoneNumber);
    if ("error" in result) {
      res.status(429).json({ error: "Please wait before requesting another code", retryAfterMs: result.retryAfterMs });
      return;
    }

    // Stand-in for a real SMS provider (Twilio, etc.), which needs
    // credentials this environment doesn't have. The code is deliberately
    // never included in the HTTP response.
    console.log(`[otp] ${phoneNumber}: ${result.code} (expires in 5 minutes)`);
    res.status(202).json({ message: "Verification code sent" });
  });

  app.post("/api/auth/signup/verify-otp", (req, res) => {
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
    const code = typeof req.body?.code === "string" ? req.body.code : undefined;
    if (!phoneNumber || !code) {
      res.status(400).json({ error: "phoneNumber and code are required" });
      return;
    }

    const result = otpService.verifyOtp(phoneNumber, code);
    if (!result.success) {
      const status = result.error === "invalid" ? 400 : result.error === "expired" ? 410 : 429;
      res.status(status).json({ error: result.error });
      return;
    }

    const user = userStore.findOrCreate(phoneNumber);
    const tokens = tokenService.issueTokens(user.id);
    res.status(200).json({ user, tokens });
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

export function createChatServer(otpService: OtpService, userStore: UserStore, tokenService: TokenService) {
  const { app, messagesByRoom } = createApp(otpService, userStore, tokenService);
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
  const httpServer = createChatServer(new OtpService(), new UserStore(), new TokenService());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
