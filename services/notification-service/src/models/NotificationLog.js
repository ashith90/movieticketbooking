const mongoose = require("mongoose");

const notificationLogSchema = new mongoose.Schema(
  {
    channel: { type: String, default: "email" },
    recipient: { type: String, default: "user" },
    eventType: { type: String, required: true, index: true },
    aggregateId: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["SENT", "FAILED"],
      default: "SENT",
      index: true,
    },
    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NotificationLog", notificationLogSchema);
