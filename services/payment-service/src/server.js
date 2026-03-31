require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const { connectProducer, connectConsumer } = require("./config/kafka");
const { startOutboxPublisher } = require("./events/outboxPublisher");
const { startBookingConsumer } = require("./events/bookingConsumer");

const port = process.env.PORT || 5004;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(task, label) {
  const maxAttempts = Number(process.env.STARTUP_MAX_RETRIES || 40);
  const waitMs = Number(process.env.STARTUP_RETRY_DELAY_MS || 2000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await task();
      return;
    } catch (error) {
      console.error(`${label} failed (attempt ${attempt}/${maxAttempts}): ${error.message}`);
      if (attempt === maxAttempts) {
        throw error;
      }
      await delay(waitMs);
    }
  }
}

async function start() {
  await connectDB();
  await withRetry(() => connectProducer(), "Kafka producer connect");
  await withRetry(() => connectConsumer(), "Kafka consumer connect");
  startOutboxPublisher();
  await withRetry(() => startBookingConsumer(), "Booking saga consumer start");
  app.listen(port, () => {
    console.log(`Payment service running on ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start payment service", error);
  process.exit(1);
});
