const { getConsumer } = require("../config/kafka");
const { processPaymentEvent } = require("../controllers/bookingController");

async function startPaymentConsumer() {
  const consumer = getConsumer();
  const paymentTopic = process.env.PAYMENT_EVENTS_TOPIC || "payment.events";

  await consumer.subscribe({ topic: paymentTopic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const raw = message.value ? message.value.toString() : "{}";
      try {
        const event = JSON.parse(raw);
        await processPaymentEvent(event);
      } catch (error) {
        console.error("Failed to process payment saga event", error.message);
      }
    },
  });

  console.log(`Booking service listening to ${paymentTopic}`);
}

module.exports = {
  startPaymentConsumer,
};
