const { Kafka } = require("kafkajs");

let consumer;

async function connectConsumer() {
  if (consumer) return consumer;

  const brokers = (process.env.KAFKA_BROKERS || "kafka:9092")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const kafka = new Kafka({
    clientId: "notification-service",
    brokers,
  });

  consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || "notification-service-group",
  });

  await consumer.connect();
  console.log("Notification service connected to Kafka");
  return consumer;
}

function getConsumer() {
  if (!consumer) {
    throw new Error("Kafka consumer not connected");
  }
  return consumer;
}

module.exports = {
  connectConsumer,
  getConsumer,
};
