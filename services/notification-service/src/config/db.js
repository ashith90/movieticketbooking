const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB || "notification_db",
  });
  console.log("Notification service connected to MongoDB");
}

module.exports = connectDB;
