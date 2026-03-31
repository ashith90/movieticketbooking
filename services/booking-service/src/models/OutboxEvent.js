const mongoose = require("mongoose");

const outboxEventSchema = new mongoose.Schema(
  {
    aggregateType: { type: String, required: true },
    aggregateId: { type: String, required: true, index: true },
    eventType: { type: String, required: true },
    topic: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["PENDING", "PUBLISHED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    publishedAt: { type: Date },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OutboxEvent", outboxEventSchema);
