import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import authRoute from "./routes/authRoute.js";
import { notFound, errorHandler } from "./middleware/error.js";

dotenv.config();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("server is running");
});

app.use("/api/auth", authRoute);

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
