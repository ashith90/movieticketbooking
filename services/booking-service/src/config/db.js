const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB || "booking_db",
  });
  console.log("Booking service connected to MongoDB");
}

module.exports = connectDB;
