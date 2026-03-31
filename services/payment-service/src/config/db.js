const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB || "payment_db",
  });
  console.log("Payment service connected to MongoDB");
}

module.exports = connectDB;
