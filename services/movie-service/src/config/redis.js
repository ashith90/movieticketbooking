const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379", {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
});

let connected = false;

async function ensureRedisConnection() {
  if (connected) return;
  try {
    await redis.connect();
    connected = true;
    console.log("Movie service connected to Redis");
  } catch (error) {
    console.error("Movie service Redis unavailable, continuing without cache", error.message);
  }
}

redis.on("error", (error) => {
  console.error("Movie service Redis error", error.message);
});

ensureRedisConnection();

module.exports = redis;
