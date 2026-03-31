const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    showtimeId: { type: String, required: true, index: true },
    seats: [{ type: String, required: true }],
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "CANCEL_REQUESTED", "CANCELLED"],
      default: "PENDING_PAYMENT",
      index: true,
    },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
