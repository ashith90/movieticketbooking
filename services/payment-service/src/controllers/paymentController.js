const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const Payment = require("../models/Payment");
const OutboxEvent = require("../models/OutboxEvent");

async function createPaymentOutboxEvent(payment, eventType, meta = {}) {
  await OutboxEvent.create({
    aggregateType: "PAYMENT",
    aggregateId: payment.paymentId,
    eventType,
    topic: process.env.PAYMENT_EVENTS_TOPIC || "payment.events",
    payload: {
      paymentId: payment.paymentId,
      bookingId: payment.bookingId,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      webhookEventId: meta.webhookEventId,
    },
  });
}

function verifyWebhookSignature(req) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers["x-webhook-signature"];
  if (!signature) return false;

  const payload = JSON.stringify(req.body || {});
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
}

async function createIntent(req, res, next) {
  try {
    const { bookingId, amount, currency, idempotencyKey } = req.body;
    if (!bookingId || !amount || !idempotencyKey) {
      return res.status(400).json({ message: "bookingId, amount and idempotencyKey are required" });
    }

    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) {
      return res.status(200).json(existing);
    }

    const payment = await Payment.create({
      paymentId: uuidv4(),
      bookingId,
      userId: req.user.userId,
      amount,
      currency: currency || "INR",
      provider: "mock",
      providerRef: `mock_${Date.now()}`,
      idempotencyKey,
      status: "PENDING",
    });

    return res.status(201).json(payment);
  } catch (error) {
    return next(error);
  }
}

async function webhook(req, res, next) {
  try {
    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ message: "Invalid webhook signature" });
    }

    const { paymentId, status } = req.body;
    const webhookEventId = String(
      req.headers["x-webhook-id"] || req.body?.webhookEventId || `${paymentId}:${status}`
    ).trim();
    if (!paymentId || !status) {
      return res.status(400).json({ message: "paymentId and status are required" });
    }

    const alreadyProcessed = await OutboxEvent.findOne({
      aggregateType: "PAYMENT",
      aggregateId: paymentId,
      eventType: { $in: ["PAYMENT_SUCCEEDED", "PAYMENT_FAILED"] },
      "payload.webhookEventId": webhookEventId,
    });

    if (alreadyProcessed) {
      return res.status(200).json({ message: "Webhook already processed" });
    }

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.status = status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED";
    await payment.save();

    await createPaymentOutboxEvent(
      payment,
      payment.status === "SUCCEEDED" ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED",
      { webhookEventId }
    );

    return res.json({ message: "Webhook processed", payment });
  } catch (error) {
    return next(error);
  }
}

async function getPayment(req, res, next) {
  try {
    const payment = await Payment.findOne({ paymentId: req.params.paymentId });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    return res.json(payment);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createIntent,
  webhook,
  getPayment,
  createPaymentOutboxEvent,
};
