const mongoose = require("mongoose");

const seatInventorySchema = new mongoose.Schema(
  {
    showtimeId: { type: String, required: true, index: true },
    seatId: { type: String, required: true },
    state: {
      type: String,
      enum: ["AVAILABLE", "LOCKED", "BOOKED"],
      default: "AVAILABLE",
      index: true,
    },
    lockedBy: { type: String },
    lockUntil: { type: Date },
  },
  { timestamps: true }
);

seatInventorySchema.index({ showtimeId: 1, seatId: 1 }, { unique: true });

module.exports = mongoose.model("SeatInventory", seatInventorySchema);
