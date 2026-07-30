import { Server } from "socket.io";

let connections = {}; // Store active socket connections
let messages = {}; // Store chat messages
let timeOnline = {}; // Store user online time

const connectToSocket = (server) => {
  const io = new Server(server);

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
          messages[path][a]["data"],
          messages[path][a]["sender"],
          messages[path][a]["socket-id-sender"],
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

      const [matchingRoom, found] = Object.entries(connections).reduce(
        // Use reduce to find the room that contains the socket ID
        ([room, isFound], [roomKey, roomValue]) => {
          // Destructure the accumulator and current room entry
          if (!isFound && roomValue.includes(socket.id)) {
            // Check if the current room contains the socket ID
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
    socket.on("disconnect", () => {});

    return io;
  });
};

export default connectToSocket;
