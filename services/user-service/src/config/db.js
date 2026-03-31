const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB || "user_db",
  });
  console.log("User service connected to MongoDB");
}

module.exports = connectDB;
