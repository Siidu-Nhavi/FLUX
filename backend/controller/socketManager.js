import { Server } from "socket.io";

let connections = {}; // Store active socket connections
let messages = {}; // Store chat messages
let timeOnline = {}; // Store user online time

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
    socket.on("join-call", (path) => {
      if (connections[path] === undefined) {
        connections[path] = [];
      }
      connections[path].push(socket.id); // Add the socket ID to the list of connections for the given path
      timeOnline[socket.id] = new Date(); // Record the time the user joined

      for (let a = 0; a < connections[path].length; ++a) {
        io.to(socket.id).emit(
          "chat-message",
          messages[path][a]["data"], // Emit the chat message data to the newly connected socket
          messages[path][a]["sender"], // Emit the sender of the chat message to the newly connected socket
          messages[path][a]["socket-id-sender"], // Emit the socket ID of the sender to the newly connected socket
        ); //
      }
    });

    // Handle signaling messages for WebRTC
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message); // Send the signaling message to the target socket
    });

    // Handle chat messages
    socket.on("chat-message", (data, sender) => {
      //here we using high order function just little bit advance in javascript

      // Use reduce to find the room that contains the socket ID
      const [matchingRoom, found] = Object.entries(connections).reduce(
        // Destructure the accumulator and current room entry
        ([room, isFound], [roomKey, roomValue]) => {
          // Check if the current room contains the socket ID
          if (!isFound && roomValue.includes(socket.id)) {
            return [roomKey, true]; // If found, return the room key and set isFound to true
          }
          return [room, isFound]; // If not found, return the previous room and isFound value
        },

        ["", false], // Initial accumulator value: empty room and isFound set to false
      );

      if (found === true) {
        if (messages[matchingRoom] === undefined) {
          messages[matchingRoom] = [];
        }
        messages[matchingRoom].push({
          data: data,
          sender: sender,
          "socket-id-sender": socket.id,
        }); // Store the chat message in the messages object for the matching room

        console.log("message", Key, ":", sender, data);

        connections[matchingRoom].forEach((elem) => {
          // Iterate over the socket IDs in the matching room
          io.to(elem).emit("chat-message", data, sender, socket.id); // Emit the chat message to each socket in the room
        });
      }
    });

    // Handle user online time tracking and disconnection
    socket.on("disconnect", () => {
      let diffTime = Math.abs(timeOnline[socket.id] - new Date()); // Calculate the time difference between when the user joined and disconnected

      let key;

      for (const [k, v] of JSON.parse(
        JSON.stringify(Object.entries(connections)),
      )) {
        // Iterate over the connections object to find the room that contains the socket ID

        for (let a = 0; a < connections[key].length; ++a) {
          // Iterate over the socket IDs in the room
          if (v[a] === socket.id) {
            //check if the current socket ID matches the disconnected socket ID
            key = k; // Store the room key for the matching room

            for (let a = 0; a < connections[key].length; ++a) {
              // Iterate over the socket IDs in the matching room
              io.to(connections[key][a]).emit("user-left", socket.id); // Emit a "user-left" event to all sockets in the room, notifying them that the user has left
            }

            let index = connections[key].indexOf(socket.id); // Find the index of the disconnected socket ID in the connections array for the matching room

            connections[key].splice(index, 1); // Remove the disconnected socket ID from the connections array for the matching room

            if (coneections[key].length === 0) {
              delete connections[key]; // If there are no more connections in the room, delete the room from the connections object
            }
          }
        }
      }
    });

    return io;
  });
};

export default connectToSocket;
