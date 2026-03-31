const NotificationLog = require("../models/NotificationLog");
const { getConsumer } = require("../config/kafka");

async function handleMessage(topic, message) {
  const rawValue = message.value ? message.value.toString() : "{}";
  const parsed = JSON.parse(rawValue);

  const payload = parsed.payload || {};

  if (
    parsed.eventType === "BOOKING_CONFIRMED" ||
    parsed.eventType === "BOOKING_CANCELLED" ||
    parsed.eventType === "PAYMENT_FAILED" ||
    parsed.eventType === "PAYMENT_REFUNDED"
  ) {
    await NotificationLog.create({
      channel: "email",
      recipient: payload.userId || "unknown",
      eventType: parsed.eventType,
      aggregateId: parsed.aggregateId || payload.bookingId || payload.paymentId || "unknown",
      payload,
      status: "SENT",
    });
  }

  console.log(`Notification event processed from ${topic}: ${parsed.eventType}`);
}

async function startConsumers() {
  const consumer = getConsumer();

  const bookingTopic = process.env.BOOKING_EVENTS_TOPIC || "booking.events";
  const paymentTopic = process.env.PAYMENT_EVENTS_TOPIC || "payment.events";

  await consumer.subscribe({ topic: bookingTopic, fromBeginning: false });
  await consumer.subscribe({ topic: paymentTopic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        await handleMessage(topic, message);
      } catch (error) {
        console.error("Failed to process notification event", error.message);
      }
    },
  });
}

module.exports = {
  startConsumers,
};
