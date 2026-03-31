const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "notification-service" });
});

app.use("/notifications", notificationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

module.exports = app;
