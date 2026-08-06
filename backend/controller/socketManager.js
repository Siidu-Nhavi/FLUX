import { Server } from "socket.io";
import { randomUUID } from "crypto";

let connections = {}; // Store active socket connections by meeting URL.
let messages = {}; // Store chat messages by meeting URL.
let timeOnline = {}; // Store each participant's join time.
let usernames = {}; // NEW: store each socket's display name, keyed by socket.id.
// Used to build "X joined the call" / "X left the call" system messages.

const connectToSocket = (server) => {
  const io = new Server(server, {
    // Development CORS configuration for browser Socket.IO clients.
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
  });

  

  /**
   * NEW: Builds a system chat message (e.g. join/leave notice), saves it to
   * the room's chat history, and broadcasts it to the given list of socket
   * ids using the same "chat-message" event/shape the client already
   * understands (data, sender, socket-id-sender, message-id). Because it
   * reuses "chat-message", no new client-side event listener is required -
   * addMessage() already renders it, and messageId still protects against
   * duplicate rendering.
   */
  const broadcastSystemMessage = (io, path, text, originSocketId, recipientIds) => {
    if (!path) return;
    messages[path] ??= [];


    const systemMessage = {
      data: text,
      sender: "System",
      "socket-id-sender": originSocketId,
      "message-id": randomUUID(),
    };
    messages[path].push(systemMessage);

    recipientIds.forEach((socketId) => {
      io.to(socketId).emit(
        "chat-message",
        systemMessage.data,
        systemMessage.sender,
        systemMessage["socket-id-sender"],
        systemMessage["message-id"],
      );
    });
  };

  // Handle socket connections.
  io.on("connection", (socket) => {
    /** Adds a socket to its meeting room and restores the room's previous chat messages. */
    // NEW: also accepts the joining user's chosen username so it can be
    // announced to everyone else already in the room.
    console.log("socket connected:", socket.id);
    socket.on("join-call", (path, username) => {
      if (connections[path] === undefined) {
        connections[path] = [];
      }
      if (messages[path] === undefined) {
        messages[path] = [];
      }
      if (!connections[path].includes(socket.id)) {
        connections[path].push(socket.id);
      }
      timeOnline[socket.id] = new Date();

      // NEW: remember this socket's display name for later join/leave
      // notices and for the disconnect handler below.
      const displayName =
        typeof username === "string" && username.trim()
          ? username.trim()
          : "Anonymous";
      usernames[socket.id] = displayName;

      // Send saved messages only to the participant who just joined.
      for (let a = 0; a < messages[path].length; ++a) {
        io.to(socket.id).emit(
          "chat-message",
          messages[path][a].data,
          messages[path][a].sender,
          messages[path][a]["socket-id-sender"],
          messages[path][a]["message-id"],
        );
      }

      // NEW: announce the new participant to everyone else already in the
      // room (the joiner already knows they joined, so they're excluded).
      const existingMembers = connections[path].filter(
        (socketId) => socketId !== socket.id,
      );
      broadcastSystemMessage(
        io,
        path,
        `${displayName} joined the call`,
        socket.id,
        existingMembers,
      );

      // Notify all clients so the newly joined client can start the WebRTC offer flow.
      connections[path].forEach((clientId) => {
        io.to(clientId).emit("user-joined", socket.id, connections[path]);
      });

      // NEW: let the joining client know the server has finished processing
      // the join (chat history replayed, join notice sent, negotiation
      // kicked off). The client uses this to hide its "connecting" loader.
      io.to(socket.id).emit("joined-room");
    });

    /** Relays WebRTC offers, answers, and ICE candidates to the selected socket. */
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    /** Saves one chat message and emits it to the sender and every other room member. */
    socket.on("chat-message", (data, sender, messageId) => {
      // Find the room containing the socket that emitted the message.
      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomKey, roomValue]) => {
          if (!isFound && roomValue.includes(socket.id)) {
            return [roomKey, true];
          }
          return [room, isFound];
        },
        ["", false],
      );

      const text = typeof data === "string" ? data.trim() : "";
      if (!found || !text) return;

      messages[matchingRoom] ??= [];
      messages[matchingRoom].push({
        data: text,
        sender:
          typeof sender === "string" && sender.trim()
            ? sender.trim()
            : "Anonymous",
        "socket-id-sender": socket.id,
        "message-id": messageId,
      });

      const latestMessage = messages[matchingRoom].at(-1);
      console.log(
        "message",
        matchingRoom,
        ":",
        latestMessage.sender,
        latestMessage.data,
      );

      // Emit to every socket in the room, including the original sender.
      connections[matchingRoom].forEach((socketId) => {
        io.to(socketId).emit(
          "chat-message",
          latestMessage.data,
          latestMessage.sender,
          latestMessage["socket-id-sender"],
          latestMessage["message-id"],
        );
      });
    });

    /** Removes a disconnected socket and tells the remaining room members it left. */
    socket.on("disconnect", () => {
      const key = Object.keys(connections).find((room) =>
        connections[room].includes(socket.id),
      );
      // NEW: capture the display name before it's cleaned up below, so the
      // leave notice can still say who left.
      const displayName = usernames[socket.id] || "Anonymous";
      delete timeOnline[socket.id];
      delete usernames[socket.id];
      if (!key) return;

      connections[key] = connections[key].filter(
        (socketId) => socketId !== socket.id,
      );

      // NEW: tell everyone still in the room that this participant left,
      // using the same system-message mechanism as the join notice.
      broadcastSystemMessage(
        io,
        key,
        `${displayName} left the call`,
        socket.id,
        connections[key],
      );

      connections[key].forEach((socketId) => {
        io.to(socketId).emit("user-left", socket.id);
      });

      if (connections[key].length === 0) {
        delete connections[key];
        delete messages[key];
      }
    });
  });

  return io;
};

export default connectToSocket;