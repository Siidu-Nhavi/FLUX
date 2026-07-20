require("dotenv").config();

const express = require("express");
const cors = require("cors");
const authRoute = require("./routes/authRoute");
const { notFound, errorHandler } = require("./middleware/error");

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

module.exports = app;
