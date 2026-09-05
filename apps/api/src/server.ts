import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, ONBOARDING_STEPS, OnboardingStep, SendMessagePayload } from "@chatapp/shared";
import { OnboardingStore } from "./onboarding";
import { UploadStore } from "./uploads";
import { VerificationStore } from "./verification";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function createApp(onboardingStore: OnboardingStore, uploadStore: UploadStore, verificationStore: VerificationStore) {
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

  app.post("/api/uploads", (req, res) => {
    const { mimeType, data } = req.body ?? {};
    if (typeof mimeType !== "string" || typeof data !== "string") {
      res.status(400).json({ error: "mimeType and data are required" });
      return;
    }
    const result = uploadStore.save(mimeType, data);
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ url: `/api/uploads/${result.id}` });
  });

  app.get("/api/uploads/:id", (req, res) => {
    const upload = uploadStore.get(req.params.id);
    if (!upload) {
      res.status(404).end();
      return;
    }
    res.set("Content-Type", upload.mimeType);
    res.send(upload.data);
  });

  // No GET endpoint for verification selfies, deliberately — see the
  // privacy note in verification.ts. Only a boolean outcome is ever
  // returned.
  app.post("/api/verification/selfie", (req, res) => {
    const { userId, mimeType, data } = req.body ?? {};
    if (typeof userId !== "string" || typeof mimeType !== "string" || typeof data !== "string") {
      res.status(400).json({ error: "userId, mimeType, and data are required" });
      return;
    }
    const result = verificationStore.saveSelfie(userId, mimeType, data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ verified: true });
  });

  // NOTE: as with #26-#35, :userId is trusted from the URL rather than a
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

export function createChatServer(onboardingStore: OnboardingStore, uploadStore: UploadStore, verificationStore: VerificationStore) {
  const { app, messagesByRoom } = createApp(onboardingStore, uploadStore, verificationStore);
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
  const verificationStore = new VerificationStore();
  const httpServer = createChatServer(new OnboardingStore(verificationStore), new UploadStore(), verificationStore);
  httpServer.listen(PORT, () => {
    console.log(`ChatApp API listening on port ${PORT}`);
  });
}
