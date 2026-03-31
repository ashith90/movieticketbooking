const express = require("express");
const crypto = require("crypto");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const client = require("prom-client");

const bookingRoutes = require("./routes/bookingRoutes");

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "booking_service_" });
const httpCounter = new client.Counter({
  name: "booking_service_http_requests_total",
  help: "Total HTTP requests handled by booking-service",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = String(requestId);
  res.setHeader("x-request-id", req.requestId);
  next();
});
app.use((req, res, next) => {
  res.on("finish", () => {
    const route = req.route?.path || req.path || "unknown";
    httpCounter.inc({
      method: req.method,
      route,
      status_code: String(res.statusCode),
    });
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "booking-service" });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/bookings", bookingRoutes);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: {
      code: "BOOKING_SERVICE_ERROR",
      message: "Internal server error",
      requestId: req.requestId,
    },
  });
});

module.exports = app;
