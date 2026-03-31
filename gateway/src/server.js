require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const client = require("prom-client");

const routes = require("./routes");

const app = express();
const port = process.env.PORT || 4000;
const publicDir = path.join(__dirname, "..", "public");
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "gateway_" });
const httpCounter = new client.Counter({
  name: "gateway_http_requests_total",
  help: "Total HTTP requests handled by gateway",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:4000")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_WRITE_MAX || 120),
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
  standardHeaders: true,
  legacyHeaders: false,
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_READ_MAX || 600),
  skip: (req) => !["GET", "HEAD", "OPTIONS"].includes(req.method),
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
app.use(express.urlencoded({ extended: false }));
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
app.use("/api/v1/auth", authLimiter);
app.use("/api/v1/catalog", readLimiter);
app.use("/api/v1", writeLimiter);

app.use(express.static(publicDir, { index: false }));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/auth", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/catalog", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/bookings", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/notifications", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/ready", (_req, res) => {
  res.json({ status: "ready", service: "api-gateway" });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api/v1", routes);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: {
      code: "GATEWAY_ERROR",
      message: "Gateway error",
      requestId: req.requestId,
    },
  });
});

app.listen(port, () => {
  console.log(`API Gateway running on ${port}`);
});
