import { Server } from "socket.io";

let connections = {}; // Store active socket connections per room (array of socket ids)
let messages = {}; // Store chat messages per room (array of { data, sender, socketIdSender })
let timeOnline = {}; // Store user online time by socket id

const connectToSocket = (server) => {
  const io = new Server(server, {
    // Configure CORS settings for the Socket.IO server agin it is not expected to be used in production but for development purpose it is used to avoid CORS error
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
  });

  // Handle socket connections
  io.on("connection", (socket) => {
    socket.on("join-call", (path, username) => {
      if (!path) return;
      if (!connections[path]) connections[path] = [];
      if (!messages[path]) messages[path] = [];

      // Add socket to connection list and record join time
      connections[path].push(socket.id);
      timeOnline[socket.id] = new Date();
      socket.join(path);

      // Send existing chat history to the newly connected socket (if any)
      for (const msg of messages[path]) {
        io.to(socket.id).emit("chat-message", msg.data, msg.sender, msg["socket-id-sender"]);
      }

      // Notify others in the room that a new user joined and provide current client list
      const clients = connections[path].slice();
      socket.emit("joined-room");
      // Broadcast to everyone (including the new socket) that a user joined; client handles filtering
      io.in(path).emit("user-joined", socket.id, clients);
      // Optionally add a system message announcing the join
      const joinNotice = username ? `${username} joined the room` : "A user joined the room";
      messages[path].push({ data: joinNotice, sender: "System", "socket-id-sender": socket.id });
      io.in(path).emit("chat-message", joinNotice, "System", socket.id);
    });

    // Handle signaling messages for WebRTC
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message); // Send the signaling message to the target socket
    });

    // Handle chat messages
    socket.on("chat-message", (data, sender, messageId) => {
      // Find the room(s) this socket belongs to by checking connections
      const matchingRoom = Object.keys(connections).find((roomKey) => connections[roomKey].includes(socket.id));
      if (!matchingRoom) return;
      if (!messages[matchingRoom]) messages[matchingRoom] = [];
      messages[matchingRoom].push({ data, sender, "socket-id-sender": socket.id, messageId });
      io.in(matchingRoom).emit("chat-message", data, sender, socket.id, messageId);
    });

    // Handle user online time tracking and disconnection
    socket.on("disconnect", () => {
      // Clean up the socket from any rooms it belonged to
      for (const [roomKey, socketList] of Object.entries(connections)) {
        const index = socketList.indexOf(socket.id);
        if (index !== -1) {
          // Notify remaining participants
          socketList.forEach((sid) => {
            io.to(sid).emit("user-left", socket.id);
          });
          // Remove from room list
          socketList.splice(index, 1);
          if (socketList.length === 0) delete connections[roomKey];
        }
      }
      // Remove online time record
      delete timeOnline[socket.id];
    });

    return io;
  });
};

export default connectToSocket;
