import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, ONBOARDING_STEPS, OnboardingStep, SendMessagePayload } from "@chatapp/shared";
import { OnboardingStore } from "./onboarding";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function createApp(onboardingStore: OnboardingStore) {
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

  // NOTE: as with #26-#32, :userId is trusted from the URL rather than a
  // verified access token — this repo has no merged auth session yet
  // (#21-#25). Should still be gated behind real auth before shipping.

  app.get("/api/onboarding/:userId", (req, res) => {
    res.json(onboardingStore.getState(req.params.userId));
  });

  app.post("/api/onboarding/:userId/step", (req, res) => {
    const { step, data } = req.body ?? {};
    if (!isOnboardingStep(step)) {
      res.status(400).json({ error: `step must be one of: ${ONBOARDING_STEPS.join(", ")}` });
      return;
    }
    const result = onboardingStore.submitStep(req.params.userId, step, data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.state);
  });

  return { app, messagesByRoom };
}

export function createChatServer(onboardingStore: OnboardingStore) {
  const { app, messagesByRoom } = createApp(onboardingStore);
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
  const httpServer = createChatServer(new OnboardingStore());
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
