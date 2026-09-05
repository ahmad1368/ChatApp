import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ChatMessage, DEFAULT_ROOM_ID, SendMessagePayload } from "@chatapp/shared";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

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

httpServer.listen(PORT, () => {
  console.log(`ChatApp API listening on port ${PORT}`);
});
