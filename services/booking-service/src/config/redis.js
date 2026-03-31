const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => {
  console.log("Booking service connected to Redis");
});

redis.on("error", (error) => {
  console.error("Redis connection error", error.message);
});

module.exports = redis;
