const { getConsumer } = require("../config/kafka");
const Payment = require("../models/Payment");
const { createPaymentOutboxEvent } = require("../controllers/paymentController");

async function handleBookingEvent(event) {
  if (event.eventType !== "BOOKING_CANCEL_REQUESTED") {
    return;
  }

  const payload = event.payload || {};
  if (!payload.bookingId) {
    return;
  }

  const payment = await Payment.findOne({
    bookingId: payload.bookingId,
    userId: payload.userId,
  }).sort({ createdAt: -1 });

  if (!payment) {
    return;
  }

  if (payment.status === "REFUNDED") {
    return;
  }

  payment.status = "REFUNDED";
  await payment.save();
  await createPaymentOutboxEvent(payment, "PAYMENT_REFUNDED");
}

async function startBookingConsumer() {
  const consumer = getConsumer();
  const bookingTopic = process.env.BOOKING_EVENTS_TOPIC || "booking.events";

  await consumer.subscribe({ topic: bookingTopic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const raw = message.value ? message.value.toString() : "{}";
      try {
        const event = JSON.parse(raw);
        await handleBookingEvent(event);
      } catch (error) {
        console.error("Failed to process booking event in payment service", error.message);
      }
    },
  });

  console.log(`Payment service listening to ${bookingTopic}`);
}

module.exports = {
  startBookingConsumer,
};
