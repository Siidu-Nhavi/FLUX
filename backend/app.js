import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import authRoute from "./routes/authRoute.js";
import meetingsRoute from "./routes/meetingsRoute.js";
import { createServer } from "node:http";
import connectToSocket from "./controller/socketManager.js";
import { notFound, errorHandler } from "./middleware/error.js";

dotenv.config();

const app = express(); //this is the main express app instance
const server = createServer(app); //this is the http server instance
const io = connectToSocket(server); //this is the socket.io instance connected to the http server

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "40kb" })); //to prevent large payloads from being sent to the server, which can be a security risk
app.use(express.urlencoded({ extended: true, limit: "40kb" })); //to parse incoming requests with urlencoded payloads

app.get("/", (req, res) => {
  res.status(200).send("server is running");
});

app.use("/api/auth", authRoute); //this is the route for authentication-related endpoints
app.use("/api/meetings", meetingsRoute); // user meetings

app.use(notFound); //this middleware handles 404 errors for undefined routes
app.use(errorHandler); //this middleware handles errors that occur in the application and sends appropriate responses to the client

const port = process.env.PORT || 5000;

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Global handlers to surface unexpected errors in the dev terminal.
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err && err.stack ? err.stack : err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

export default app;
