const express = require("express");
const crypto = require("crypto");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const client = require("prom-client");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "user_service_" });
const httpCounter = new client.Counter({
  name: "user_service_http_requests_total",
  help: "Total HTTP requests handled by user-service",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:4000")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 25),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin denied"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = String(requestId);
  res.setHeader("x-request-id", req.requestId);
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
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "user-service" });
});

app.get("/ready", (_req, res) => {
  res.json({ status: "ready", service: "user-service" });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/auth", authLimiter);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: {
      code: "USER_SERVICE_ERROR",
      message: "Internal server error",
      requestId: req.requestId,
    },
  });
});

module.exports = app;
