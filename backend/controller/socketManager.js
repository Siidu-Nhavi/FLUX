import { Server } from "socket.io";
import { randomUUID } from "node:crypto";

const messagesByRoom = new Map();

const normalizeOrigin = (value) => value?.trim().replace(/\/$/, "");
const normalizeRoomId = (value) =>
  String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

const connectToSocket = (server) => {
  const allowedOrigins = new Set(
    [process.env.FRONTEND_URL, process.env.CLIENT_URL, "http://localhost:5173"]
      .map(normalizeOrigin)
      .filter(Boolean),
  );

  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        const normalizedOrigin = normalizeOrigin(origin);
        if (!origin || allowedOrigins.has(normalizedOrigin)) {
          return callback(null, true);
        }
        console.warn("[socket] rejected origin", origin);
        return callback(new Error("Socket origin is not allowed."));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.info("[socket] connected", socket.id);

    socket.on("join-call", (roomPath, username) => {
      const roomId = normalizeRoomId(roomPath);
      if (!roomId || socket.data.roomId === roomId) {
        console.warn("[socket] join-call rejected", {
          socketId: socket.id,
          reason: !roomId ? "empty room ID" : "already in room",
          requestedRoom: roomId,
          currentRoom: socket.data.roomId,
        });
        return;
      }

      const existingSocketIds = Array.from(
        io.sockets.adapter.rooms.get(roomId) || [],
      );
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.username = String(username || "").trim();

      const history = messagesByRoom.get(roomId) || [];
      console.info("[socket] replaying message history", { 
        roomId, 
        socketId: socket.id,
        historyCount: history.length
      });
      history.forEach((message) => socket.emit("chat-message", ...message));

      console.info("[socket] room joined", {
        roomId,
        socketId: socket.id,
        username: socket.data.username,
        existingPeers: existingSocketIds.length,
      });
      
      socket.emit("joined-room", roomId);
      // Only the new participant receives peers and creates offers.
      socket.emit("existing-users", existingSocketIds);
      // Notify existing users that a new user joined
      socket.to(roomId).emit("user-joined", socket.id);

      const joinNotice = socket.data.username
        ? `${socket.data.username} joined the room`
        : "A user joined the room";
      const joinMessage = [joinNotice, "System", socket.id, randomUUID()];
      messagesByRoom.set(roomId, [...history, joinMessage]);
      io.to(roomId).emit("chat-message", ...joinMessage);
    });

    socket.on("signal", (targetSocketId, payload) => {
      const roomId = socket.data.roomId;
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!roomId || targetSocket?.data.roomId !== roomId) {
        console.warn("[socket] signal relay rejected", {
          from: socket.id,
          to: targetSocketId,
          reason: !roomId ? "sender has no room" : "target not in same room",
          targetRoomId: targetSocket?.data.roomId,
          senderRoomId: roomId,
        });
        return;
      }
      
      let signalType = "unknown";
      try {
        const parsed = JSON.parse(payload);
        if (parsed.sdp) signalType = parsed.sdp.type;
        else if (parsed.ice) signalType = "ice-candidate";
      } catch (e) {
        // payload is not JSON, ignore
      }
      
      console.info("[socket] relaying signal", {
        from: socket.id,
        to: targetSocketId,
        roomId,
        type: signalType,
      });
      
      io.to(targetSocketId).emit("signal", socket.id, payload);
    });

    socket.on("chat-message", (data, sender, messageId) => {
      const roomId = socket.data.roomId;
      const text = String(data || "").trim();
      if (!roomId || !text) {
        console.warn("[socket] chat message rejected", { 
          reason: !roomId ? "no room" : "empty text",
          socketId: socket.id,
          roomId
        });
        return;
      }

      const chatMessage = [
        text,
        String(sender || socket.data.username || "Anonymous"),
        socket.id,
        messageId || randomUUID(),
      ];
      const history = messagesByRoom.get(roomId) || [];
      messagesByRoom.set(roomId, [...history, chatMessage]);

      console.info("[socket] chat message", { 
        roomId, 
        socketId: socket.id,
        sender: String(sender || socket.data.username || "Anonymous"),
        messageId: messageId || "auto-generated",
        text: text.substring(0, 50)
      });
      // The sender already renders locally; only peers need the broadcast.
      // Broadcast to all users EXCEPT the sender
      socket.to(roomId).emit("chat-message", ...chatMessage);
    });

    socket.on("disconnecting", () => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        console.info("[socket] disconnecting without room", { socketId: socket.id });
        return;
      }
      console.info("[socket] leaving room", { roomId, socketId: socket.id });
      socket.to(roomId).emit("user-left", socket.id);
    });

    socket.on("disconnect", (reason) => {
      const roomId = socket.data.roomId;
      if (roomId && !io.sockets.adapter.rooms.has(roomId)) {
        console.info("[socket] room is now empty, cleaning up message history", { roomId });
        messagesByRoom.delete(roomId);
      }
      console.info("[socket] disconnected", { 
        socketId: socket.id, 
        roomId,
        reason 
      });
    });
  });

  return io;
};

export default connectToSocket;
