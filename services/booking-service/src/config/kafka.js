const { Kafka } = require("kafkajs");

let producer;
let consumer;

function getKafkaClient() {
  const brokers = (process.env.KAFKA_BROKERS || "kafka:9092")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return new Kafka({
    clientId: "booking-service",
    brokers,
  });
}

async function connectProducer() {
  if (producer) return producer;

  const kafka = getKafkaClient();

  producer = kafka.producer();
  await producer.connect();
  console.log("Booking service connected to Kafka");
  return producer;
}

async function connectConsumer() {
  if (consumer) return consumer;

  const kafka = getKafkaClient();
  consumer = kafka.consumer({
    groupId: process.env.BOOKING_SAGA_GROUP_ID || "booking-saga-group",
  });

  await consumer.connect();
  console.log("Booking service Kafka consumer connected");
  return consumer;
}

function getProducer() {
  if (!producer) {
    throw new Error("Kafka producer not connected");
  }
  return producer;
}

function getConsumer() {
  if (!consumer) {
    throw new Error("Kafka consumer not connected");
  }
  return consumer;
}

module.exports = {
  connectProducer,
  connectConsumer,
  getProducer,
  getConsumer,
};
