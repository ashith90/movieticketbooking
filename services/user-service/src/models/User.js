const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    city: { type: String },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },
    refreshTokenHash: { type: String },
    refreshTokenExpiresAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
