const OutboxEvent = require("../models/OutboxEvent");
const { getProducer } = require("../config/kafka");

let timer;

async function publishPendingEvents() {
  const pending = await OutboxEvent.find({ status: { $in: ["PENDING", "FAILED"] } })
    .sort({ createdAt: 1 })
    .limit(50);

  if (pending.length === 0) return;

  const producer = getProducer();

  for (const event of pending) {
    try {
      await producer.send({
        topic: event.topic,
        messages: [
          {
            key: event.aggregateId,
            value: JSON.stringify({
              eventType: event.eventType,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              payload: event.payload,
              createdAt: event.createdAt,
            }),
          },
        ],
      });

      event.status = "PUBLISHED";
      event.publishedAt = new Date();
      event.lastError = undefined;
      await event.save();
    } catch (error) {
      event.status = "FAILED";
      event.retryCount += 1;
      event.lastError = error.message;
      await event.save();
    }
  }
}

function startOutboxPublisher() {
  if (timer) return;
  timer = setInterval(() => {
    publishPendingEvents().catch((error) => {
      console.error("Booking outbox publish error", error.message);
    });
  }, 3000);
}

function stopOutboxPublisher() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  publishPendingEvents,
  startOutboxPublisher,
  stopOutboxPublisher,
};
